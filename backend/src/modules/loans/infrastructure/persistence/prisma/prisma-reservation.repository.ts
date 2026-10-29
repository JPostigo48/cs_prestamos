import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import {
  instantToDate,
  nullableInstantToDate,
} from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import { LoanStatus, type Loan } from '../../../domain/entities/loan.js';
import type { Reservation } from '../../../domain/entities/reservation.js';
import {
  ReservationRepository,
  type CancelReservationData,
  type CreateReservationData,
} from '../../../domain/repositories/reservation.repository.js';
import type {
  Page,
  ReservationsQuery,
} from '../../../domain/repositories/loan-queries.js';
import { captureLoanConfiguration } from '../../integration/capture-loan-configuration.js';
import { assertTransactionalEligibility } from '../../integration/assert-transactional-eligibility.js';

@Injectable()
export class PrismaReservationRepository implements ReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private runtime() {
    return this.prisma.client.runtime();
  }

  private instant(value: Date) {
    return Temporal.Instant.from(value.toISOString());
  }

  private map(row: any, loanId: string | null = null): Reservation {
    return {
      id: row.id,
      userId: row.usuarioId,
      copyId: row.ejemplarId,
      requestedAt: instantToDate(row.fechaSolicitada),
      pickupDeadline: instantToDate(row.fechaLimiteRecogida),
      loanDurationHours: row.duracionPrestamoHoras,
      pickedUpAt: nullableInstantToDate(row.fechaRecogida),
      cancelledAt: nullableInstantToDate(row.fechaCancelacion),
      status: row.estado,
      cancellationReason: row.motivoCancelacion,
      loanId,
      configurationSnapshot: row.configurationSnapshot ?? null,
    };
  }

  private select() {
    return this.prisma.sql.public.reservas.select(
      'id',
      'usuarioId',
      'ejemplarId',
      'fechaSolicitada',
      'fechaLimiteRecogida',
      'duracionPrestamoHoras',
      'fechaRecogida',
      'fechaCancelacion',
      'estado',
      'motivoCancelacion',
      'configurationSnapshot',
    );
  }

  async findMany(query: ReservationsQuery): Promise<Page<Reservation>> {
    const filter = () => {
      const base = this.select();
      // Predicados aplicados antes de paginar y antes del conteo.
      return base.where((row, f) =>
        f.and(
          ...(query.userId ? [f.eq(row.usuarioId, query.userId)] : []),
          ...(query.copyId ? [f.eq(row.ejemplarId, query.copyId)] : []),
          ...(query.status ? [f.eq(row.estado, query.status)] : []),
        ),
      );
    };
    const counts = await this.runtime().query(
      this.prisma.sql.public.reservas
        .select((_r, f) => ({ total: f.count() }))
        .where((r, f) =>
          f.and(
            ...(query.userId ? [f.eq(r.usuarioId, query.userId)] : []),
            ...(query.copyId ? [f.eq(r.ejemplarId, query.copyId)] : []),
            ...(query.status ? [f.eq(r.estado, query.status)] : []),
          ),
        )
        .build(),
    );
    const rows = await this.runtime().query(
      filter()
        .orderBy((r) => r.fechaSolicitada, { direction: 'desc' })
        .orderBy((r) => r.id, { direction: 'asc' })
        .limit(query.limit)
        .offset((query.page - 1) * query.limit)
        .build(),
    );
    const items = await Promise.all(
      rows.map(async (row) => {
        const loans = await this.runtime().query(
          this.prisma.sql.public.prestamos
            .select('id')
            .where((r, f) => f.eq(r.reservaId, row.id))
            .limit(1)
            .build(),
        );
        return this.map(row, loans[0]?.id ?? null);
      }),
    );
    return {
      items,
      total: Number(counts[0]?.total ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async hasOpenReservationOrLoan(userId: string): Promise<boolean> {
    const reservations = await this.runtime().query(
      this.prisma.sql.public.reservas
        .select('id')
        .where((row, fns) => fns.eq(row.usuarioId, userId))
        .where((row, fns) => fns.eq(row.estado, 'CONFIRMADA'))
        .limit(1)
        .build(),
    );
    if (reservations[0]) return true;
    const loans = await this.runtime().query(
      this.prisma.sql.public.prestamos
        .select('id')
        .where((row, fns) => fns.eq(row.usuarioId, userId))
        .where((row, fns) => fns.eq(row.estado, 'ACTIVO'))
        .limit(1)
        .build(),
    );
    return Boolean(loans[0]);
  }

  async create(data: CreateReservationData): Promise<Reservation> {
    try {
      const rows = await this.prisma.client.transaction(async (tx) => {
        // Todos los tipos de usuario se serializan con la baja administrativa.
        const users = await tx.query(
          this.prisma.sql.public.usuarios
            .update({ vinculacionVigente: true })
            .where((row, fns) => fns.eq(row.id, data.userId))
            .where((row, fns) => fns.eq(row.vinculacionVigente, true))
            .returning('id')
            .build(),
        );
        if (!users[0])
          throw new ConflictException(
            'El usuario no es elegible para préstamos.',
          );
        await assertTransactionalEligibility(this.prisma, tx, data.userId, new Date());
        if (data.enforceSingleOpenOperation) {
          const reservations = await tx.query(
            this.prisma.sql.public.reservas
              .select('id')
              .where((row, fns) => fns.eq(row.usuarioId, data.userId))
              .where((row, fns) => fns.eq(row.estado, 'CONFIRMADA'))
              .limit(1)
              .build(),
          );
          const loans = await tx.query(
            this.prisma.sql.public.prestamos
              .select('id')
              .where((row, fns) => fns.eq(row.usuarioId, data.userId))
              .where((row, fns) => fns.eq(row.estado, 'ACTIVO'))
              .limit(1)
              .build(),
          );
          if (reservations[0] || loans[0]) {
            throw new ConflictException(
              'El estudiante ya tiene una operación abierta.',
            );
          }
        }
        const copies = await tx.query(
          this.prisma.sql.public.ejemplares
            .update({ estado: 'RESERVADO' })
            .where((row, fns) => fns.eq(row.id, data.copyId))
            .where((row, fns) => fns.eq(row.estado, 'DISPONIBLE'))
            .returning('id')
            .build(),
        );
        if (!copies[0])
          throw new ConflictException('El ejemplar no está disponible.');
        const snapshot = await captureLoanConfiguration(
          this.prisma,
          tx,
          data.copyId,
        );
        const reservations = await tx.query(
          this.prisma.sql.public.reservas
            .insert([
              {
                usuarioId: data.userId,
                ejemplarId: data.copyId,
                fechaSolicitada: this.instant(data.requestedAt),
                fechaLimiteRecogida: this.instant(data.pickupDeadline),
                duracionPrestamoHoras: snapshot.policy.effectiveDurationHours,
                configurationSnapshot: {
                  ...snapshot,
                  policy: { ...snapshot.policy },
                  accessories: snapshot.accessories.map((a) => ({ ...a })),
                },
                estado: 'CONFIRMADA',
                updatedAt: this.instant(new Date()),
              },
            ])
            .returning(
              'id',
              'usuarioId',
              'ejemplarId',
              'fechaSolicitada',
              'fechaLimiteRecogida',
              'duracionPrestamoHoras',
              'fechaRecogida',
              'fechaCancelacion',
              'estado',
              'motivoCancelacion',
              'configurationSnapshot',
            )
            .build(),
        );
        if (!reservations[0])
          throw new InternalServerErrorException(
            'No se pudo crear la reserva.',
          );
        return reservations[0];
      });
      return this.map(rows);
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      throw new ConflictException('No se pudo crear la reserva.');
    }
  }

  async findById(reservationId: string): Promise<Reservation | null> {
    const rows = await this.runtime().query(
      this.select()
        .where((row, fns) => fns.eq(row.id, reservationId))
        .limit(1)
        .build(),
    );
    if (!rows[0]) return null;
    const loans = await this.runtime().query(
      this.prisma.sql.public.prestamos
        .select('id')
        .where((row, fns) => fns.eq(row.reservaId, reservationId))
        .limit(1)
        .build(),
    );
    return this.map(rows[0], loans[0]?.id ?? null);
  }

  async pickup(
    reservationId: string,
    pickedUpAt: Date,
  ): Promise<{ reservation: Reservation; loan: Loan }> {
    return this.prisma.client.transaction(async (tx) => {
      const reservations = await tx.query(
        this.select()
          .where((row, fns) => fns.eq(row.id, reservationId))
          .where((row, fns) => fns.eq(row.estado, 'CONFIRMADA'))
          .limit(1)
          .build(),
      );
      const reservation = reservations[0];
      if (!reservation)
        throw new ConflictException('La reserva ya no está disponible.');
      const users = await tx.query(this.prisma.sql.public.usuarios
        .update({ id: reservation.usuarioId })
        .where((r, f) => f.eq(r.id, reservation.usuarioId))
        .where((r, f) => f.eq(r.vinculacionVigente, true))
        .returning('id').build());
      if (!users[0]) throw new ConflictException('El usuario no es elegible para préstamos.');
      await assertTransactionalEligibility(this.prisma, tx, reservation.usuarioId, new Date());
      const updated = await tx.query(
        this.prisma.sql.public.reservas
          .update({
            estado: 'RECOGIDA',
            fechaRecogida: this.instant(pickedUpAt),
          })
          .where((row, fns) => fns.eq(row.id, reservationId))
          .where((row, fns) => fns.eq(row.estado, 'CONFIRMADA'))
          .where((row, fns) =>
            fns.gte(row.fechaLimiteRecogida, this.instant(pickedUpAt)),
          )
          .where((row, fns) =>
            fns.lte(row.fechaSolicitada, this.instant(pickedUpAt)),
          )
          .returning(
            'id',
            'usuarioId',
            'ejemplarId',
            'fechaSolicitada',
            'fechaLimiteRecogida',
            'duracionPrestamoHoras',
            'fechaRecogida',
            'fechaCancelacion',
            'estado',
            'motivoCancelacion',
            'configurationSnapshot',
          )
          .build(),
      );
      if (!updated[0])
        throw new ConflictException('La reserva ya fue procesada.');
      const copies = await tx.query(
        this.prisma.sql.public.ejemplares
          .update({ estado: 'PRESTADO' })
          .where((row, fns) => fns.eq(row.id, reservation.ejemplarId))
          .where((row, fns) => fns.eq(row.estado, 'RESERVADO'))
          .returning('id')
          .build(),
      );
      if (!copies[0])
        throw new ConflictException('El ejemplar ya no está reservado.');
      const loans = await tx.query(
        this.prisma.sql.public.prestamos
          .insert([
            {
              usuarioId: reservation.usuarioId,
              ejemplarId: reservation.ejemplarId,
              reservaId: reservationId,
              configurationSnapshot: reservation.configurationSnapshot ?? null,
              fechaInicio: this.instant(pickedUpAt),
              fechaFin: this.instant(
                new Date(
                  pickedUpAt.getTime() +
                    reservation.duracionPrestamoHoras * 60 * 60 * 1000,
                ),
              ),
              estado: 'ACTIVO',
              updatedAt: this.instant(new Date()),
            },
          ])
          .returning(
            'id',
            'usuarioId',
            'ejemplarId',
            'reservaId',
            'fechaInicio',
            'fechaFin',
            'estado',
            'configurationSnapshot',
          )
          .build(),
      );
      if (!loans[0])
        throw new InternalServerErrorException('No se pudo crear el préstamo.');
      return {
        reservation: this.map(updated[0], loans[0].id),
        loan: {
          id: loans[0].id,
          userId: loans[0].usuarioId,
          copyId: loans[0].ejemplarId,
          startsAt: instantToDate(loans[0].fechaInicio),
          endsAt: instantToDate(loans[0].fechaFin),
          status: loans[0].estado as LoanStatus,
          return: null,
          configurationSnapshot:
            (reservation.configurationSnapshot as Loan['configurationSnapshot']) ??
            null,
          returnChecklist: null,
        },
      };
    });
  }

  async cancel(data: CancelReservationData): Promise<Reservation> {
    return this.prisma.client.transaction(async (tx) => {
      const rows = await tx.query(
        this.prisma.sql.public.reservas
          .update({
            estado: 'CANCELADA',
            fechaCancelacion: this.instant(data.cancelledAt),
            motivoCancelacion: data.reason?.trim() || null,
          })
          .where((row, fns) => fns.eq(row.id, data.reservationId))
          .where((row, fns) => fns.eq(row.estado, 'CONFIRMADA'))
          .where((row, fns) =>
            fns.gte(row.fechaLimiteRecogida, this.instant(data.cancelledAt)),
          )
          .returning(
            'id',
            'usuarioId',
            'ejemplarId',
            'fechaSolicitada',
            'fechaLimiteRecogida',
            'duracionPrestamoHoras',
            'fechaRecogida',
            'fechaCancelacion',
            'estado',
            'motivoCancelacion',
            'configurationSnapshot',
          )
          .build(),
      );
      if (!rows[0])
        throw new ConflictException('La reserva ya no puede cancelarse.');
      await tx.query(
        this.prisma.sql.public.ejemplares
          .update({ estado: 'DISPONIBLE' })
          .where((row, fns) => fns.eq(row.id, rows[0].ejemplarId))
          .where((row, fns) => fns.eq(row.estado, 'RESERVADO'))
          .build(),
      );
      return this.map(rows[0]);
    });
  }

  async expire(at: Date): Promise<Reservation[]> {
    return this.prisma.client.transaction(async (tx) => {
      const rows = await tx.query(
        this.prisma.sql.public.reservas
          .update({
            estado: 'VENCIDA',
            fechaCancelacion: this.instant(at),
            motivoCancelacion: 'Ventana de recogida vencida',
          })
          .where((row, fns) => fns.eq(row.estado, 'CONFIRMADA'))
          .where((row, fns) =>
            fns.lt(row.fechaLimiteRecogida, this.instant(at)),
          )
          .returning(
            'id',
            'usuarioId',
            'ejemplarId',
            'fechaSolicitada',
            'fechaLimiteRecogida',
            'duracionPrestamoHoras',
            'fechaRecogida',
            'fechaCancelacion',
            'estado',
            'motivoCancelacion',
            'configurationSnapshot',
          )
          .build(),
      );
      for (const row of rows) {
        await tx.query(
          this.prisma.sql.public.ejemplares
            .update({ estado: 'DISPONIBLE' })
            .where((copy, fns) => fns.eq(copy.id, row.ejemplarId))
            .where((copy, fns) => fns.eq(copy.estado, 'RESERVADO'))
            .build(),
        );
      }
      return rows.map((row: any) => this.map(row));
    });
  }
}
