import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type { Violation } from '../../../domain/entities/violation.js';
import { calculateTrustPenalty } from '../../../domain/entities/violation.js';
import { scheduleSanction } from '../../../domain/entities/sanction-schedule.js';
import { SuspensionType } from '../../../domain/entities/usage-rule.js';
import { Temporal } from 'temporal-polyfill/full';
import { instantToDate } from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import {
  ViolationRepository,
  type RegisterViolationData,
} from '../../../domain/repositories/violation.repository.js';

type Runtime = Pick<ReturnType<PrismaService['client']['runtime']>, 'query'>;
type ReservationPenaltyData = RegisterViolationData & { reservationId: string };

@Injectable()
export class PrismaViolationRepository implements ViolationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private runtime() {
    return this.prisma.client.runtime();
  }
  private map(row: any): Violation {
    return {
      id: row.id,
      userId: row.usuarioId,
      ruleId: row.reglaId,
      ruleVersionId: row.versionReglaId,
      occurredAt: instantToDate(row.fecha),
      appliedPenalty: Number(row.penalizacionAplicada),
    };
  }
  async createWithPenalty(data: RegisterViolationData): Promise<Violation> {
    return this.prisma.client.transaction((tx) =>
      this.register(tx, data, new Date()),
    );
  }

  /** Puerto interno transaccional, sin exposición en el registro manual HTTP. */
  async createReservationPenalty(
    tx: Runtime,
    data: ReservationPenaltyData,
    at: Date,
  ): Promise<Violation> {
    return this.register(tx, data, at);
  }

  private async register(
    tx: Runtime,
    data: RegisterViolationData & { reservationId?: string },
    registeredAt: Date,
  ): Promise<Violation> {
    const users = await tx.query(
      this.prisma.sql.public.usuarios
        .update({ id: data.userId })
        .where((row, fns) => fns.eq(row.id, data.userId))
        .returning('id', 'confianza')
        .build(),
    );
    const user = users[0];
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const previousTrust = Number(user.confianza);
    if (
      !Number.isFinite(previousTrust) ||
      previousTrust < 0 ||
      previousTrust > 100
    )
      throw new ConflictException(
        'La confianza del usuario está fuera de rango.',
      );
    const { appliedPenalty, resultingTrust } = calculateTrustPenalty(
      previousTrust,
      data.trustEffect === 'SET_ZERO' ? previousTrust : data.configuredPenalty,
    );
    const updated = await tx.query(
      this.prisma.sql.public.usuarios
        .update({ confianza: resultingTrust.toFixed(2) })
        .where((row, fns) => fns.eq(row.id, data.userId))
        .where((row, fns) => fns.eq(row.confianza, previousTrust.toFixed(2)))
        .returning('id')
        .build(),
    );
    if (!updated[0])
      throw new ConflictException(
        'La confianza cambió durante el registro; reintente.',
      );
    const pendingEndsAt: Date[] = [];
    if (data.suspensionType === SuspensionType.TEMPORARY) {
      const sanctions = await tx.query(
        this.prisma.sql.public.sanciones
          .select('estado', 'fechaFin')
          .where((row, fns) => fns.eq(row.usuarioId, data.userId))
          .build(),
      );
      for (const sanction of sanctions) {
        if (
          (sanction.estado === 'ACTIVA' || sanction.estado === 'PROGRAMADA') &&
          sanction.fechaFin &&
          instantToDate(sanction.fechaFin) > registeredAt
        ) {
          pendingEndsAt.push(instantToDate(sanction.fechaFin));
        }
      }
    }
    let schedule;
    try {
      schedule = scheduleSanction(
        data.suspensionType,
        data.suspensionDays,
        registeredAt,
        pendingEndsAt,
      );
    } catch (error) {
      if (error instanceof RangeError)
        throw new BadRequestException(error.message);
      throw error;
    }
    const rows = await tx.query(
      this.prisma.sql.public.incumplimientos
        .insert([
          {
            usuarioId: data.userId,
            reglaId: data.ruleId,
            versionReglaId: data.ruleVersionId,
            ...(data.reservationId ? { reservaId: data.reservationId } : {}),
            fecha: Temporal.Instant.from(data.occurredAt.toISOString()),
            penalizacionAplicada: appliedPenalty.toFixed(2),
          },
        ])
        .returning(
          'id',
          'usuarioId',
          'reglaId',
          'versionReglaId',
          'fecha',
          'penalizacionAplicada',
        )
        .build(),
    );
    const violation = this.map(rows[0]);
    const sanctions = await tx.query(
      this.prisma.sql.public.sanciones
        .insert([
          {
            usuarioId: data.userId,
            incumplimientoId: violation.id,
            reglaId: data.ruleId,
            versionReglaId: data.ruleVersionId,
            estado: schedule.status,
            fechaInicio: Temporal.Instant.from(schedule.startsAt.toISOString()),
            fechaFin: schedule.endsAt
              ? Temporal.Instant.from(schedule.endsAt.toISOString())
              : null,
            confianzaAnterior: previousTrust.toFixed(2),
            confianzaPosterior: resultingTrust.toFixed(2),
          },
        ])
        .returning('id')
        .build(),
    );
    if (!sanctions[0])
      throw new ConflictException('No se pudo registrar la sanción.');
    const audit = await tx.query(
      this.prisma.sql.public.auditorias_usuario
        .insert([
          {
            usuarioId: data.userId,
            accion: 'CONFIANZA_ACTUALIZADA',
            datosAnteriores: JSON.stringify({ confianza: previousTrust }),
            datosNuevos: JSON.stringify({
              confianza: resultingTrust,
              incumplimientoId: violation.id,
              sanctionId: sanctions[0].id,
              ...(data.reservationId
                ? {
                    reservationId: data.reservationId,
                    ruleVersionId: data.ruleVersionId,
                    source: 'RESERVATION_EXPIRY',
                  }
                : {}),
            }),
            fecha: Temporal.Instant.from(registeredAt.toISOString()),
          },
        ])
        .returning('id')
        .build(),
    );
    if (!audit[0])
      throw new ConflictException('No se pudo registrar la auditoría.');
    return violation;
  }

  async findById(violationId: string): Promise<Violation | null> {
    const rows = await this.runtime().query(
      this.prisma.sql.public.incumplimientos
        .select(
          'id',
          'usuarioId',
          'reglaId',
          'versionReglaId',
          'fecha',
          'penalizacionAplicada',
        )
        .where((r, f) => f.eq(r.id, violationId))
        .limit(1)
        .build(),
    );
    return rows[0] ? this.map(rows[0]) : null;
  }
}
