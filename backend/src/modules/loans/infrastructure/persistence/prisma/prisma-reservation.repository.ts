import { lockLoanInventory } from '../../../../../shared/infrastructure/prisma/lock-loan-inventory.js';
import { lockPublishedLoanPolicy } from '../../../../../shared/infrastructure/prisma/lock-loan-inventory.js';
import { PrismaTermsRepository } from '../../../../rules/infrastructure/persistence/prisma/prisma-terms.repository.js';
import type { RulesTransaction } from '../../../../rules/infrastructure/persistence/prisma/historical-loan-policy.reader.js';
import { copyTrustAllowed } from '../../integration/loan-trust-access.js';
import { releaseReservedCopy } from '../../integration/release-reserved-copy.js';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  HttpException,
  ServiceUnavailableException,
  Logger,
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
import {
  captureLoanConfiguration,
  assertActiveInventory,
} from '../../integration/capture-loan-configuration.js';
import { LoanOverdueSynchronizer } from '../../loan-overdue-synchronizer.js';
import { readReservationSettings } from '../../../../system/infrastructure/prisma-reservation-settings.repository.js';
import {
  calculatePickupDeadline,
  INSTITUTION_TIME_ZONE,
} from '../../../../system/domain/reservation-settings.js';
import { registerReservationNoShow } from '../../integration/reservation-no-show.js';

@Injectable()
export class PrismaReservationRepository implements ReservationRepository {
  private expiryAfter: string | null = null;
  private readonly logger = new Logger(PrismaReservationRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  private async operationEligibility(
    tx: RulesTransaction,
    userId: string,
    copyId: string,
  ) {
    await lockPublishedLoanPolicy(this.prisma, tx);
    if (
      !(await new PrismaTermsRepository(this.prisma)
        .forTransaction(tx)
        .hasAcceptedCurrentVersion(userId))
    )
      return new ConflictException('Debe aceptar los términos vigentes.');
    try {
      if (!(await copyTrustAllowed(this.prisma, tx, userId, copyId)))
        return new ConflictException(
          'La confianza no autoriza esta categoría.',
        );
    } catch (error) {
      if (error instanceof HttpException) return error;
      throw error;
    }
    return null;
  }

  private get overdue() {
    return new LoanOverdueSynchronizer(this.prisma);
  }

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
      'createdAt',
    );
  }

  async findMany(query: ReservationsQuery): Promise<Page<Reservation>> {
    await this.expire(new Date());
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
    await this.expire(new Date());
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
    await this.overdue.synchronizeUser(data.userId);
    await this.expire(new Date());
    try {
      const rows = await this.prisma.client.transaction(async (tx) => {
        await lockLoanInventory(this.prisma, tx);
        // Todos los tipos de usuario se serializan con la baja administrativa.
        const users = await tx.query(
          this.prisma.sql.public.usuarios
            .update({ vinculacionVigente: true })
            .where((row, fns) => fns.eq(row.id, data.userId))
            .where((row, fns) => fns.eq(row.vinculacionVigente, true))
            .returning('id', 'tipoUsuario')
            .build(),
        );
        if (!users[0])
          throw new ConflictException(
            'El usuario no es elegible para préstamos.',
          );
        const eligibilityError = await this.overdue.recheckLocked(
          tx,
          data.userId,
        );
        if (eligibilityError) return { error: eligibilityError };
        const operationError = await this.operationEligibility(
          tx,
          data.userId,
          data.copyId,
        );
        if (operationError) return { error: operationError };
        // El tipo autoritativo proviene de la fila bloqueada, no del llamador.
        if (users[0].tipoUsuario === 'ESTUDIANTE') {
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
            return {
              error: new ConflictException(
                'El estudiante ya tiene una operación abierta.',
              ),
            };
          }
        }
        const copies = await tx.query(
          this.prisma.sql.public.ejemplares
            .update({ id: data.copyId })
            .where((row, fns) => fns.eq(row.id, data.copyId))
            .where((row, fns) => fns.eq(row.estado, 'DISPONIBLE'))
            .where((row, fns) => fns.eq(row.condicionFisica, 'APTO'))
            .where((row, fns) => fns.eq(row.habilitado, true))
            .returning('id')
            .build(),
        );
        if (!copies[0])
          return {
            error: new ConflictException('El ejemplar no está disponible.'),
          };
        let snapshot: Awaited<ReturnType<typeof captureLoanConfiguration>>;
        try {
          snapshot = await captureLoanConfiguration(
            this.prisma,
            tx,
            data.copyId,
          );
        } catch (error) {
          if (error instanceof HttpException) return { error };
          throw error;
        }
        const settings = await readReservationSettings(this.prisma, tx, true);
        const pickupDeadline = calculatePickupDeadline(
          data.requestedAt,
          settings,
        );
        await tx.query(
          this.prisma.sql.public.ejemplares
            .update({ estado: 'RESERVADO' })
            .where((r, f) => f.eq(r.id, data.copyId))
            .build(),
        );
        const reservations = await tx.query(
          this.prisma.sql.public.reservas
            .insert([
              {
                usuarioId: data.userId,
                ejemplarId: data.copyId,
                fechaSolicitada: this.instant(data.requestedAt),
                fechaLimiteRecogida: this.instant(pickupDeadline),
                duracionPrestamoHoras: snapshot.policy.effectiveDurationHours,
                configurationSnapshot: {
                  ...snapshot,
                  reservationSettings: {
                    version: settings.version,
                    pickupWaitMinutes: settings.pickupWaitMinutes,
                    weeklySchedule:
                      settings.weeklySchedule?.map((d) => ({
                        ...d,
                        intervals: d.intervals.map((i) => ({ ...i })),
                      })) ?? null,
                    timeZone: INSTITUTION_TIME_ZONE,
                  },
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
      if ('error' in rows) throw rows.error;
      return this.map(rows);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ConflictException('No se pudo crear la reserva.');
    }
  }

  async findById(reservationId: string): Promise<Reservation | null> {
    await this.expire(new Date());
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
    const initial = await this.runtime().query(
      this.select()
        .where((r, f) => f.eq(r.id, reservationId))
        .limit(1)
        .build(),
    );
    if (!initial[0])
      throw new ConflictException('La reserva ya no está disponible.');
    await this.overdue.synchronizeUser(initial[0].usuarioId);
    await this.expire(pickedUpAt);
    const result = await this.prisma.client.transaction(async (tx) => {
      await lockLoanInventory(this.prisma, tx);
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
      const users = await tx.query(
        this.prisma.sql.public.usuarios
          .update({ id: reservation.usuarioId })
          .where((r, f) => f.eq(r.id, reservation.usuarioId))
          .where((r, f) => f.eq(r.vinculacionVigente, true))
          .returning('id', 'tipoUsuario')
          .build(),
      );
      if (!users[0])
        throw new ConflictException(
          'El usuario no es elegible para préstamos.',
        );
      const eligibilityError = await this.overdue.recheckLocked(
        tx,
        reservation.usuarioId,
      );
      if (eligibilityError) return { error: eligibilityError };
      const operationError = await this.operationEligibility(
        tx,
        reservation.usuarioId,
        reservation.ejemplarId,
      );
      if (operationError) return { error: operationError };
      // Bloquear TODAS las filas que pueden causar espera antes de capturar el reloj.
      const locked = await tx.query(
        this.prisma.sql.public.reservas
          .update({ id: reservationId })
          .where((r, f) => f.eq(r.id, reservationId))
          .where((r, f) => f.eq(r.estado, 'CONFIRMADA'))
          .returning('id')
          .build(),
      );
      if (!locked[0])
        return { error: new ConflictException('La reserva ya fue procesada.') };
      await tx.query(
        this.prisma.sql.public.ejemplares
          .update({ id: reservation.ejemplarId })
          .where((r, f) => f.eq(r.id, reservation.ejemplarId))
          .returning('id')
          .build(),
      );
      try {
        await assertActiveInventory(this.prisma, tx, reservation.ejemplarId);
      } catch (error) {
        if (error instanceof HttpException) return { error };
        throw error;
      }
      pickedUpAt = new Date();
      if (pickedUpAt > instantToDate(reservation.fechaLimiteRecogida)) {
        await this.expireLocked(tx, reservation, pickedUpAt);
        return {
          error: new ConflictException('La ventana de recogida venció.'),
        };
      }
      if (pickedUpAt < instantToDate(reservation.fechaSolicitada))
        return {
          error: new ConflictException(
            'Todavía no comienza la ventana de recogida.',
          ),
        };
      if (users[0].tipoUsuario === 'ESTUDIANTE') {
        const loans = await tx.query(
          this.prisma.sql.public.prestamos
            .select('id')
            .where((r, f) => f.eq(r.usuarioId, reservation.usuarioId))
            .where((r, f) => f.eq(r.estado, 'ACTIVO'))
            .limit(1)
            .build(),
        );
        const others = await tx.query(
          this.prisma.sql.public.reservas
            .select('id')
            .where((r, f) => f.eq(r.usuarioId, reservation.usuarioId))
            .where((r, f) => f.eq(r.estado, 'CONFIRMADA'))
            .where((r, f) => f.ne(r.id, reservationId))
            .limit(1)
            .build(),
        );
        if (loans[0] || others[0])
          return {
            error: new ConflictException(
              'El estudiante ya tiene otra operación abierta.',
            ),
          };
      }
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
          .where((row, fns) => fns.eq(row.condicionFisica, 'APTO'))
          .where((row, fns) => fns.eq(row.habilitado, true))
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
    if ('error' in result) throw result.error;
    return result;
  }

  async cancel(data: CancelReservationData): Promise<Reservation> {
    const result = await this.prisma.client.transaction(async (tx) => {
      await lockLoanInventory(this.prisma, tx);
      const initial = (
        await tx.query(
          this.select()
            .where((r, f) => f.eq(r.id, data.reservationId))
            .limit(1)
            .build(),
        )
      )[0];
      if (!initial)
        throw new ConflictException('La reserva ya no puede cancelarse.');
      await this.overdue.lockUser(tx, initial.usuarioId);
      const eligibilityError = await this.overdue.recheckLocked(
        tx,
        initial.usuarioId,
      );
      if (eligibilityError) return { error: eligibilityError };
      const locked = (
        await tx.query(
          this.prisma.sql.public.reservas
            .update({ id: initial.id })
            .where((r, f) => f.eq(r.id, initial.id))
            .where((r, f) => f.eq(r.estado, 'CONFIRMADA'))
            .returning('id', 'usuarioId', 'ejemplarId', 'fechaLimiteRecogida')
            .build(),
        )
      )[0];
      if (!locked)
        return {
          error: new ConflictException('La reserva ya no puede cancelarse.'),
        };
      await tx.query(
        this.prisma.sql.public.ejemplares
          .update({ id: locked.ejemplarId })
          .where((r, f) => f.eq(r.id, locked.ejemplarId))
          .returning('id')
          .build(),
      );
      data = { ...data, cancelledAt: new Date() };
      if (data.cancelledAt > instantToDate(locked.fechaLimiteRecogida)) {
        await this.expireLocked(tx, initial, data.cancelledAt);
        return {
          error: new ConflictException('La ventana de recogida venció.'),
        };
      }
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
      await releaseReservedCopy(this.prisma, tx, rows[0].ejemplarId);
      return this.map(rows[0]);
    });
    if ('error' in result) throw result.error;
    return result;
  }

  async expire(at: Date): Promise<Reservation[]> {
    try {
      let query = this.select()
        .where((r, f) => f.eq(r.estado, 'CONFIRMADA'))
        .where((r, f) => f.lt(r.fechaLimiteRecogida, this.instant(at)));
      if (this.expiryAfter)
        query = query.where((r, f) => f.gt(r.id, this.expiryAfter!));
      const candidates = await this.runtime().query(
        query
          .orderBy((r) => r.id, { direction: 'asc' })
          .limit(100)
          .build(),
      );
      const expired: Reservation[] = [];
      for (const candidate of candidates) {
        // Avanzar incluso si la unidad no tiene política resoluble. Se reintenta
        // en la siguiente vuelta del cursor, nunca ocupa permanentemente el lote.
        this.expiryAfter = candidate.id;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            // Confirmar consecuencias antes de reclamar VENCIDA: nunca fabricar no-show
            // para una reserva que el motor debía cancelar.
            await this.overdue.synchronizeUser(candidate.usuarioId);
            const result = await this.prisma.client.transaction(async (tx) => {
              await lockLoanInventory(this.prisma, tx);
              // Mismo orden que pickup/create/sanciones: usuario -> reserva -> ejemplar.
              const users = await tx.query(
                this.prisma.sql.public.usuarios
                  .update({ id: candidate.usuarioId })
                  .where((r, f) => f.eq(r.id, candidate.usuarioId))
                  .returning('id')
                  .build(),
              );
              if (!users[0])
                throw new ServiceUnavailableException(
                  'No se pudo bloquear el titular de la reserva.',
                );
              if (await this.overdue.recheckLocked(tx, candidate.usuarioId))
                return null;
              return this.expireLocked(tx, candidate, at);
            });
            if (result) expired.push(result);
            break;
          } catch {
            if (attempt === 1)
              this.logger.warn(
                'Reserva pendiente de vencimiento: unidad revertida; se reintentará tras avanzar el cursor.',
              );
          }
        }
      }
      if (candidates.length < 100) this.expiryAfter = null;
      return expired;
    } catch (error) {
      throw new ServiceUnavailableException(
        'No se pudo consultar el vencimiento. Reintente más tarde.',
        { cause: error },
      );
    }
  }

  /** La reclamación, liberación y no-show se confirman o revierten juntos. */
  private async expireLocked(
    tx: RulesTransaction,
    candidate: { id: string },
    at: Date,
  ) {
    const rows = await tx.query(
      this.prisma.sql.public.reservas
        .update({
          estado: 'VENCIDA',
          fechaCancelacion: this.instant(at),
          motivoCancelacion: 'Ventana de recogida vencida',
        })
        .where((row, fns) => fns.eq(row.id, candidate.id))
        .where((row, fns) => fns.eq(row.estado, 'CONFIRMADA'))
        .where((row, fns) => fns.lt(row.fechaLimiteRecogida, this.instant(at)))
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
          'createdAt',
        )
        .build(),
    );
    const row = rows[0];
    if (!row) return null; // Otro worker, recogida o cancelación ya la procesó.
    await releaseReservedCopy(this.prisma, tx, row.ejemplarId);
    await registerReservationNoShow(this.prisma, tx, row, at);
    return this.map(row);
  }
}
