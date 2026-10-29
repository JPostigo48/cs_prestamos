import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import {
  instantToDate,
  nullableInstantToDate,
} from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import { effectiveSanctionStatus } from '../../../domain/entities/sanction-schedule.js';
import { Temporal } from 'temporal-polyfill/full';
import type { Appeal } from '../../../domain/entities/appeal.js';
import {
  AppealRepository,
  type AppealableSanction,
  type ResolveAppealData,
  type SubmitAppealData,
} from '../../../domain/repositories/appeal.repository.js';

@Injectable()
export class PrismaAppealRepository implements AppealRepository {
  constructor(private readonly prisma: PrismaService) {}

  private runtime() {
    return this.prisma.client.runtime();
  }
  private map(row: any): Appeal {
    return {
      id: row.id,
      violationId: row.incumplimientoId,
      sanctionId: row.sancionId,
      userId: row.usuarioId,
      reason: row.motivo,
      submittedAt: instantToDate(row.fecha),
      status: row.estado,
      resolution: row.resolucion,
      resolvedAt: nullableInstantToDate(row.fechaResolucion),
      resolvedByAccountId: row.resueltaPorCuentaId,
    };
  }
  async create(data: SubmitAppealData): Promise<Appeal> {
    try {
      const rows = await this.runtime().query(
        this.prisma.sql.public.apelaciones
          .insert([
            {
              incumplimientoId: data.violationId,
              sancionId: data.sanctionId,
              usuarioId: data.userId,
              motivo: data.reason,
              fecha: Temporal.Instant.from(data.submittedAt.toISOString()),
            },
          ])
          .returning(
            'id',
            'incumplimientoId',
            'sancionId',
            'usuarioId',
            'motivo',
            'fecha',
            'estado',
            'resolucion',
            'fechaResolucion',
            'resueltaPorCuentaId',
          )
          .build(),
      );
      return this.map(rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('La sanción ya tiene una apelación.');
      }
      throw error;
    }
  }

  async findById(appealId: string): Promise<Appeal | null> {
    const rows = await this.runtime().query(
      this.prisma.sql.public.apelaciones
        .select(
          'id',
          'incumplimientoId',
          'sancionId',
          'usuarioId',
          'motivo',
          'fecha',
          'estado',
          'resolucion',
          'fechaResolucion',
          'resueltaPorCuentaId',
        )
        .where((r, f) => f.eq(r.id, appealId))
        .limit(1)
        .build(),
    );
    return rows[0] ? this.map(rows[0]) : null;
  }

  async findByViolationId(violationId: string): Promise<Appeal | null> {
    const rows = await this.runtime().query(
      this.prisma.sql.public.apelaciones
        .select(
          'id',
          'incumplimientoId',
          'sancionId',
          'usuarioId',
          'motivo',
          'fecha',
          'estado',
          'resolucion',
          'fechaResolucion',
          'resueltaPorCuentaId',
        )
        .where((r, f) => f.eq(r.incumplimientoId, violationId))
        .limit(1)
        .build(),
    );
    return rows[0] ? this.map(rows[0]) : null;
  }

  async findSanctionById(
    sanctionId: string,
  ): Promise<AppealableSanction | null> {
    const rows = await this.runtime().query(
      this.prisma.sql.public.sanciones
        .select(
          'id',
          'usuarioId',
          'incumplimientoId',
          'estado',
          'fechaInicio',
          'fechaFin',
        )
        .where((row, fns) => fns.eq(row.id, sanctionId))
        .limit(1)
        .build(),
    );
    const sanction = rows[0];
    if (!sanction) return null;
    const now = new Date();
    const startsAt = instantToDate(sanction.fechaInicio);
    const endsAt = nullableInstantToDate(sanction.fechaFin);
    const status = effectiveSanctionStatus(
      { status: sanction.estado, startsAt, endsAt },
      now,
    );
    return {
      id: sanction.id,
      violationId: sanction.incumplimientoId,
      userId: sanction.usuarioId,
      status,
      startsAt,
      endsAt,
    };
  }

  async resolve(data: ResolveAppealData): Promise<Appeal> {
    return this.prisma.client.transaction(async (tx) => {
      const pending = (
        await tx.query(
          this.prisma.sql.public.apelaciones
            .select('usuarioId')
            .where((r, f) => f.eq(r.id, data.appealId))
            .limit(1)
            .build(),
        )
      )[0];
      if (!pending)
        throw new ConflictException(
          'La apelación ya fue resuelta o no existe.',
        );
      await tx.query(
        this.prisma.sql.public.usuarios
          .update({ id: pending.usuarioId })
          .where((r, f) => f.eq(r.id, pending.usuarioId))
          .returning('id')
          .build(),
      );
      const rows = await tx.query(
        this.prisma.sql.public.apelaciones
          .update({
            estado: data.status,
            resolucion: data.resolution,
            fechaResolucion: Temporal.Instant.from(
              data.resolvedAt.toISOString(),
            ),
            resueltaPorCuentaId: data.resolvedByAccountId,
          })
          .where((r, f) => f.eq(r.id, data.appealId))
          .where((r, f) => f.eq(r.estado, 'PENDIENTE'))
          .returning(
            'id',
            'incumplimientoId',
            'sancionId',
            'usuarioId',
            'motivo',
            'fecha',
            'estado',
            'resolucion',
            'fechaResolucion',
            'resueltaPorCuentaId',
          )
          .build(),
      );
      const appeal = rows[0];
      if (!appeal)
        throw new ConflictException(
          'La apelación ya fue resuelta o no existe.',
        );
      if (data.status === 'ACEPTADA') {
        const sanctionQuery = this.prisma.sql.public.sanciones.select(
          'id',
          'usuarioId',
          'estado',
          'confianzaAnterior',
          'confianzaPosterior',
        );
        const sanctions = await tx.query(
          (appeal.sancionId
            ? sanctionQuery.where((r, f) => f.eq(r.id, appeal.sancionId))
            : sanctionQuery.where((r, f) =>
                f.eq(r.incumplimientoId, appeal.incumplimientoId),
              )
          )
            .limit(1)
            .build(),
        );
        const sanction = sanctions[0];
        if (
          !sanction ||
          sanction.usuarioId !== appeal.usuarioId ||
          sanction.estado === 'ABSUELTA'
        ) {
          throw new ConflictException('La sanción no puede ser absuelta.');
        }
        const users = await tx.query(
          this.prisma.sql.public.usuarios
            .select('id', 'confianza')
            .where((r, f) => f.eq(r.id, appeal.usuarioId))
            .limit(1)
            .build(),
        );
        const user = users[0];
        if (!user)
          throw new ConflictException('Usuario de la sanción no encontrado.');
        const deducted = Math.max(
          0,
          Number(sanction.confianzaAnterior) -
            Number(sanction.confianzaPosterior),
        );
        const previousTrust = Number(user.confianza);
        const resultingTrust = Math.min(100, previousTrust + deducted);
        const absolved = await tx.query(
          this.prisma.sql.public.sanciones
            .update({ estado: 'ABSUELTA' })
            .where((r, f) => f.eq(r.id, sanction.id))
            .where((r, f) => f.eq(r.estado, sanction.estado))
            .returning('id')
            .build(),
        );
        if (!absolved[0])
          throw new ConflictException('La sanción cambió durante la revisión.');
        const updatedUsers = await tx.query(
          this.prisma.sql.public.usuarios
            .update({ confianza: resultingTrust.toFixed(2) })
            .where((r, f) => f.eq(r.id, appeal.usuarioId))
            .where((r, f) => f.eq(r.confianza, previousTrust.toFixed(2)))
            .returning('id')
            .build(),
        );
        if (!updatedUsers[0])
          throw new ConflictException(
            'La confianza cambió durante la revisión.',
          );
        await tx.query(
          this.prisma.sql.public.auditorias_usuario
            .insert([
              {
                usuarioId: appeal.usuarioId,
                accion: 'CONFIANZA_RESTITUIDA_POR_APELACION',
                datosAnteriores: JSON.stringify({
                  confianza: previousTrust,
                  sancionId: sanction.id,
                }),
                motivo: data.resolution,
                fecha: Temporal.Instant.from(data.resolvedAt.toISOString()),
                datosNuevos: JSON.stringify({
                  confianza: resultingTrust,
                  sancionId: sanction.id,
                  actorAccountId: data.resolvedByAccountId,
                  puntosRestituidos: resultingTrust - previousTrust,
                }),
              },
            ])
            .returning('id')
            .build(),
        );
      }
      await tx.query(
        this.prisma.sql.public.auditorias_usuario
          .insert([
            {
              usuarioId: appeal.usuarioId,
              accion: 'APELACION_RESUELTA',
              motivo: data.resolution,
              fecha: Temporal.Instant.from(data.resolvedAt.toISOString()),
              datosAnteriores: JSON.stringify({ estado: 'PENDIENTE' }),
              datosNuevos: JSON.stringify({
                sanctionId: appeal.sancionId,
                incumplimientoId: appeal.incumplimientoId,
                appealId: appeal.id,
                status: data.status,
                actorAccountId: data.resolvedByAccountId,
              }),
            },
          ])
          .returning('id')
          .build(),
      );
      return this.map(appeal);
    });
  }
}
