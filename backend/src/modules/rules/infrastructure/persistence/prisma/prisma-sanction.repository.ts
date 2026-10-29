import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import {
  instantToDate,
  nullableInstantToDate,
} from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import type { AuditActor } from '../../../../../shared/application/audit-actor.js';
import {
  SanctionRepository,
  type AppealsQuery,
  type SanctionDetail,
  type SuspendUserData,
} from '../../../domain/repositories/sanction.repository.js';
import type { Appeal, AppealStatus } from '../../../domain/entities/appeal.js';
import type {
  RuleVersion,
  RuleStatus,
} from '../../../domain/entities/usage-rule.js';
import { SuspensionType } from '../../../domain/entities/usage-rule.js';
import { calculateTrustPenalty } from '../../../domain/entities/violation.js';
import {
  effectiveSanctionStatus,
  scheduleSanction,
} from '../../../domain/entities/sanction-schedule.js';
import { readOfficialPolicyEffect } from '../../../domain/official-policy.catalog.js';

type Runtime = Pick<ReturnType<PrismaService['client']['runtime']>, 'query'>;
type SanctionRow = {
  id: string;
  usuarioId: string;
  incumplimientoId: string | null;
  reglaId: string | null;
  versionReglaId: string | null;
  estado: SanctionDetail['status'];
  fechaInicio: unknown;
  fechaFin: unknown;
  confianzaAnterior: string;
  confianzaPosterior: string;
};
type AppealRow = {
  id: string;
  incumplimientoId: string;
  sancionId: string | null;
  usuarioId: string;
  motivo: string;
  fecha: unknown;
  estado: `${AppealStatus}`;
  resolucion: string | null;
  fechaResolucion: unknown;
  resueltaPorCuentaId: string | null;
};

/** Auditoría histórica: nunca interpreta texto no JSON ni fabrica datos ausentes. */
function payload(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

@Injectable()
export class PrismaSanctionRepository implements SanctionRepository {
  constructor(private readonly prisma: PrismaService) {}
  private runtime() {
    return this.prisma.client.runtime();
  }
  private instant(date: Date) {
    return Temporal.Instant.from(date.toISOString());
  }
  private sanctions() {
    return this.prisma.sql.public.sanciones.select(
      'id',
      'usuarioId',
      'incumplimientoId',
      'reglaId',
      'versionReglaId',
      'estado',
      'fechaInicio',
      'fechaFin',
      'confianzaAnterior',
      'confianzaPosterior',
    );
  }
  private appeals() {
    return this.prisma.sql.public.apelaciones.select(
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
    );
  }
  private auditRows(userId: string, runtime: Runtime) {
    return runtime.query(
      this.prisma.sql.public.auditorias_usuario
        .select(
          'id',
          'accion',
          'motivo',
          'datosAnteriores',
          'datosNuevos',
          'fecha',
        )
        .where((r, f) => f.eq(r.usuarioId, userId))
        .orderBy((r) => r.fecha, { direction: 'asc' })
        .orderBy((r) => r.id, { direction: 'asc' })
        .build(),
    );
  }
  private mapAppeal(row: AppealRow): Appeal {
    return {
      id: row.id,
      violationId: row.incumplimientoId,
      sanctionId: row.sancionId,
      userId: row.usuarioId,
      reason: row.motivo,
      submittedAt: instantToDate(row.fecha),
      status: row.estado as AppealStatus,
      resolution: row.resolucion,
      resolvedAt: nullableInstantToDate(row.fechaResolucion),
      resolvedByAccountId: row.resueltaPorCuentaId,
    };
  }
  private schedule(row: SanctionRow) {
    return {
      status: row.estado,
      startsAt: instantToDate(row.fechaInicio),
      endsAt: nullableInstantToDate(row.fechaFin),
    };
  }
  private async lockUser(userId: string, runtime: Runtime) {
    // Actualización neutra: bloqueo de fila compartido con crear/recoger reservas.
    const rows = await runtime.query(
      this.prisma.sql.public.usuarios
        .update({ id: userId })
        .where((r, f) => f.eq(r.id, userId))
        .returning('id', 'confianza')
        .build(),
    );
    if (!rows[0]) throw new NotFoundException('Usuario no encontrado.');
    return rows[0];
  }
  private async audit(
    runtime: Runtime,
    userId: string,
    action: string,
    reason: string,
    actor: AuditActor,
    before: unknown,
    after: Record<string, unknown>,
    at: Date,
  ) {
    await runtime.query(
      this.prisma.sql.public.auditorias_usuario
        .insert([
          {
            usuarioId: userId,
            accion: action,
            motivo: reason,
            datosAnteriores: JSON.stringify(before),
            datosNuevos: JSON.stringify({
              ...after,
              actorAccountId: actor.accountId,
              actorUserId: actor.userId,
            }),
            fecha: this.instant(at),
          },
        ])
        .returning('id')
        .build(),
    );
  }

  async listAppeals(query: AppealsQuery) {
    const counts = await this.runtime().query(
      this.prisma.sql.public.apelaciones
        .select((_r, f) => ({ total: f.count() }))
        .where((r, f) =>
          f.and(
            ...(query.userId ? [f.eq(r.usuarioId, query.userId)] : []),
            ...(query.sanctionId ? [f.eq(r.sancionId, query.sanctionId)] : []),
            ...(query.status ? [f.eq(r.estado, query.status)] : []),
          ),
        )
        .build(),
    );
    const rows = await this.runtime().query(
      this.appeals()
        .where((r, f) =>
          f.and(
            ...(query.userId ? [f.eq(r.usuarioId, query.userId)] : []),
            ...(query.sanctionId ? [f.eq(r.sancionId, query.sanctionId)] : []),
            ...(query.status ? [f.eq(r.estado, query.status)] : []),
          ),
        )
        .orderBy((r) => r.fecha, { direction: 'desc' })
        .orderBy((r) => r.id, { direction: 'asc' })
        .offset((query.page - 1) * query.limit)
        .limit(query.limit)
        .build(),
    );
    return {
      items: rows.map((r) => this.mapAppeal(r)),
      total: Number(counts[0]?.total ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async findDetail(id: string): Promise<SanctionDetail | null> {
    return this.detail(id, this.runtime());
  }
  private async detail(
    id: string,
    runtime: Runtime,
  ): Promise<SanctionDetail | null> {
    const row = (
      await runtime.query(
        this.sanctions()
          .where((r, f) => f.eq(r.id, id))
          .limit(1)
          .build(),
      )
    )[0];
    if (!row) return null;
    const schedule = this.schedule(row);
    const versions = row.versionReglaId
      ? await runtime.query(
          this.prisma.sql.public.versiones_regla
            .select(
              'id',
              'reglaId',
              'numero',
              'titulo',
              'descripcion',
              'penalizacionPorcentual',
              'consecuencia',
              'tipoSuspension',
              'diasSuspension',
              'estado',
            )
            .where((r, f) => f.eq(r.id, row.versionReglaId!))
            .limit(1)
            .build(),
        )
      : [];
    const version = versions[0];
    const rule: RuleVersion | null = version
      ? {
          id: version.id,
          ruleId: version.reglaId,
          number: version.numero,
          title: version.titulo,
          description: version.descripcion,
          penaltyPercentage: Number(version.penalizacionPorcentual),
          consequence: version.consecuencia,
          suspensionType: version.tipoSuspension as SuspensionType | null,
          suspensionDays: version.diasSuspension,
          status: version.estado as RuleStatus,
        }
      : null;
    const violations = row.incumplimientoId
      ? await runtime.query(
          this.prisma.sql.public.incumplimientos
            .select(
              'id',
              'usuarioId',
              'reglaId',
              'versionReglaId',
              'fecha',
              'penalizacionAplicada',
            )
            .where((r, f) => f.eq(r.id, row.incumplimientoId!))
            .limit(1)
            .build(),
        )
      : [];
    const violation = violations[0];
    const appeals = await runtime.query(
      this.appeals()
        .where((r, f) => f.eq(r.sancionId, id))
        .orderBy((r) => r.fecha, { direction: 'asc' })
        .build(),
    );
    const audit = (await this.auditRows(row.usuarioId, runtime)).filter((a) => {
      const p = payload(a.datosNuevos);
      return (
        p.sanctionId === id ||
        p.sancionId === id ||
        (row.incumplimientoId !== null &&
          p.incumplimientoId === row.incumplimientoId)
      );
    });
    const registered = audit.find((a) => a.accion === 'SUSPENSION_REGISTRADA');
    return {
      id,
      userId: row.usuarioId,
      violationId: row.incumplimientoId,
      ruleId: row.reglaId,
      ruleVersionId: row.versionReglaId,
      ...schedule,
      status: effectiveSanctionStatus(schedule, new Date()),
      previousTrust: Number(row.confianzaAnterior),
      resultingTrust: Number(row.confianzaPosterior),
      reason: registered?.motivo ?? null,
      rule,
      violation: violation
        ? {
            id: violation.id,
            userId: violation.usuarioId,
            ruleId: violation.reglaId,
            ruleVersionId: violation.versionReglaId,
            occurredAt: instantToDate(violation.fecha),
            appliedPenalty: Number(violation.penalizacionAplicada),
          }
        : null,
      appeals: appeals.map((a) => this.mapAppeal(a)),
      history: audit.map((a) => {
        const p = payload(a.datosNuevos);
        return {
          action: a.accion,
          occurredAt: instantToDate(a.fecha),
          actorAccountId:
            typeof p.actorAccountId === 'string' ? p.actorAccountId : null,
          reason: a.motivo,
        };
      }),
    };
  }

  async suspend(data: SuspendUserData): Promise<SanctionDetail> {
    return this.prisma.client.transaction(async (tx) => {
      const user = await this.lockUser(data.userId, tx);
      const fingerprint = JSON.stringify({
        ruleId: data.ruleId,
        reason: data.reason,
        startsAt: data.startsAt?.toISOString() ?? null,
        endsAt:
          data.endsAt === undefined
            ? 'UNSPECIFIED'
            : (data.endsAt?.toISOString() ?? null),
      });
      const retry = (await this.auditRows(data.userId, tx)).find(
        (a) =>
          a.accion === 'SUSPENSION_REGISTRADA' &&
          payload(a.datosNuevos).requestId === data.requestId,
      );
      if (retry) {
        const p = payload(retry.datosNuevos);
        if (
          p.fingerprint !== fingerprint ||
          p.actorAccountId !== data.actor.accountId
        )
          throw new ConflictException(
            'La clave de reintento ya se utilizó con otra solicitud.',
          );
        const existing =
          typeof p.sanctionId === 'string'
            ? await this.detail(p.sanctionId, tx)
            : null;
        if (!existing)
          throw new ConflictException(
            'El antecedente de reintento no tiene una sanción consultable.',
          );
        return existing;
      }
      const rules = await tx.query(
        this.prisma.sql.public.reglas_uso
          .update({ id: data.ruleId })
          .where((r, f) => f.eq(r.id, data.ruleId))
          .returning('id', 'versionVigenteId')
          .build(),
      );
      const rule = rules[0];
      if (!rule?.versionVigenteId)
        throw new NotFoundException('Regla activa no encontrada.');
      const versions = await tx.query(
        this.prisma.sql.public.versiones_regla
          .update({ id: rule.versionVigenteId })
          .where((r, f) => f.eq(r.id, rule.versionVigenteId!))
          .where((r, f) => f.eq(r.estado, 'ACTIVA'))
          .returning(
            'id',
            'descripcion',
            'penalizacionPorcentual',
            'tipoSuspension',
            'diasSuspension',
          )
          .build(),
      );
      const version = versions[0];
      if (!version)
        throw new NotFoundException('Versión activa no encontrada.');
      const policy = readOfficialPolicyEffect(version.descripcion);
      if (policy && !['DAMAGE', 'LOSS'].includes(policy.kind))
        throw new ConflictException(
          'Esta política no admite suspensión manual sin su contexto específico.',
        );
      const penalty = Number(version.penalizacionPorcentual);
      if (
        policy?.trustEffect === 'SET_ZERO'
          ? penalty !== 0 ||
            version.tipoSuspension !== SuspensionType.INDEFINITE ||
            version.diasSuspension !== null
          : policy?.trustEffect === 'NONE' || penalty <= 0 || penalty > 100
      )
        throw new ConflictException(
          'La versión no configura una penalización manual válida.',
        );
      if (
        version.tipoSuspension !== SuspensionType.TEMPORARY &&
        version.tipoSuspension !== SuspensionType.INDEFINITE
      )
        throw new ConflictException('La versión no configura una suspensión.');
      const now = new Date();
      const pending = await tx.query(
        this.sanctions()
          .where((r, f) => f.eq(r.usuarioId, data.userId))
          .build(),
      );
      let schedule;
      try {
        schedule = scheduleSanction(
          version.tipoSuspension as SuspensionType,
          version.diasSuspension,
          now,
          pending
            .filter((r) => {
              const s = this.schedule(r);
              return (
                ['ACTIVA', 'PROGRAMADA'].includes(
                  effectiveSanctionStatus(s, now),
                ) && s.endsAt !== null
              );
            })
            .map((r) => instantToDate(r.fechaFin)),
        );
      } catch (error) {
        if (error instanceof RangeError)
          throw new ConflictException(error.message);
        throw error;
      }
      if (schedule.startsAt > now) schedule.status = 'PROGRAMADA';
      if (
        data.startsAt !== undefined &&
        data.startsAt.getTime() !== schedule.startsAt.getTime()
      )
        throw new BadRequestException(
          'El inicio esperado no coincide con el calendario automático de la política.',
        );
      if (
        data.endsAt !== undefined &&
        (data.endsAt?.getTime() ?? null) !==
          (schedule.endsAt?.getTime() ?? null)
      )
        throw new BadRequestException(
          'El fin solicitado no coincide con la duración de la política versionada.',
        );
      const previousTrust = Number(user.confianza);
      const { appliedPenalty, resultingTrust } = calculateTrustPenalty(
        previousTrust,
        policy?.trustEffect === 'SET_ZERO' ? previousTrust : penalty,
      );
      const violation = (
        await tx.query(
          this.prisma.sql.public.incumplimientos
            .insert([
              {
                usuarioId: data.userId,
                reglaId: data.ruleId,
                versionReglaId: version.id,
                fecha: this.instant(now),
                penalizacionAplicada: appliedPenalty.toFixed(2),
              },
            ])
            .returning('id')
            .build(),
        )
      )[0]!;
      const sanction = (
        await tx.query(
          this.prisma.sql.public.sanciones
            .insert([
              {
                usuarioId: data.userId,
                incumplimientoId: violation.id,
                reglaId: data.ruleId,
                versionReglaId: version.id,
                estado: schedule.status,
                fechaInicio: this.instant(schedule.startsAt),
                fechaFin: schedule.endsAt
                  ? this.instant(schedule.endsAt)
                  : null,
                confianzaAnterior: previousTrust.toFixed(2),
                confianzaPosterior: resultingTrust.toFixed(2),
                updatedAt: this.instant(now),
              },
            ])
            .returning('id')
            .build(),
        )
      )[0]!;
      await tx.query(
        this.prisma.sql.public.usuarios
          .update({ confianza: resultingTrust.toFixed(2) })
          .where((r, f) => f.eq(r.id, data.userId))
          .build(),
      );
      const cancelled = await this.cancelReservations(
        tx,
        data.userId,
        data.reason,
        now,
      );
      await this.audit(
        tx,
        data.userId,
        'SUSPENSION_REGISTRADA',
        data.reason,
        data.actor,
        { confianza: previousTrust },
        {
          sanctionId: sanction.id,
          incumplimientoId: violation.id,
          requestId: data.requestId,
          fingerprint,
          ruleId: data.ruleId,
          ruleVersionId: version.id,
          schedule,
          confianza: resultingTrust,
          cancelledReservationIds: cancelled,
        },
        now,
      );
      return (await this.detail(sanction.id, tx))!;
    });
  }

  private async cancelReservations(
    tx: Runtime,
    userId: string,
    reason: string,
    now: Date,
  ) {
    const reservations = await tx.query(
      this.prisma.sql.public.reservas
        .update({
          estado: 'CANCELADA',
          fechaCancelacion: this.instant(now),
          motivoCancelacion: `Suspensión: ${reason}`,
        })
        .where((r, f) => f.eq(r.usuarioId, userId))
        .where((r, f) => f.eq(r.estado, 'CONFIRMADA'))
        .returning('id', 'ejemplarId')
        .build(),
    );
    for (const reservation of reservations) {
      const loans = await tx.query(
        this.prisma.sql.public.prestamos
          .select('id')
          .where((r, f) => f.eq(r.ejemplarId, reservation.ejemplarId))
          .where((r, f) => f.eq(r.estado, 'ACTIVO'))
          .limit(1)
          .build(),
      );
      if (loans[0])
        throw new ConflictException(
          'Reserva inconsistente con un préstamo activo; no se liberó el ejemplar.',
        );
      const copies = await tx.query(
        this.prisma.sql.public.ejemplares
          .update({ estado: 'DISPONIBLE' })
          .where((r, f) => f.eq(r.id, reservation.ejemplarId))
          .where((r, f) => f.eq(r.estado, 'RESERVADO'))
          .returning('id')
          .build(),
      );
      if (!copies[0])
        throw new ConflictException(
          'El ejemplar de la reserva ya no está reservado; reintente tras revisar su estado.',
        );
    }
    return reservations.map((r) => r.id);
  }

  async lift(
    id: string,
    resolution: string,
    actor: AuditActor,
  ): Promise<SanctionDetail> {
    return this.prisma.client.transaction(async (tx) => {
      const initial = (
        await tx.query(
          this.sanctions()
            .where((r, f) => f.eq(r.id, id))
            .limit(1)
            .build(),
        )
      )[0];
      if (!initial) throw new NotFoundException('Sanción no encontrada.');
      await this.lockUser(initial.usuarioId, tx);
      const row = (
        await tx.query(
          this.sanctions()
            .where((r, f) => f.eq(r.id, id))
            .limit(1)
            .build(),
        )
      )[0]!;
      const history = await this.auditRows(row.usuarioId, tx);
      const retry = history.find(
        (a) =>
          a.accion === 'SUSPENSION_LEVANTADA' &&
          payload(a.datosNuevos).sanctionId === id,
      );
      if (retry) {
        if (row.estado === 'ABSUELTA')
          throw new ConflictException(
            'La sanción fue absuelta después del levantamiento.',
          );
        if (retry.motivo !== resolution)
          throw new ConflictException(
            'La sanción ya se levantó con otra resolución.',
          );
        return (await this.detail(id, tx))!;
      }
      const now = new Date(),
        before = this.schedule(row);
      if (
        !['ACTIVA', 'PROGRAMADA'].includes(effectiveSanctionStatus(before, now))
      )
        throw new ConflictException(
          'Solo puede levantar sanciones activas o programadas.',
        );
      const startsAt = before.startsAt > now ? now : before.startsAt;
      const updated = await tx.query(
        this.prisma.sql.public.sanciones
          .update({
            estado: 'FINALIZADA',
            fechaInicio: this.instant(startsAt),
            fechaFin: this.instant(now),
          })
          .where((r, f) => f.eq(r.id, id))
          .where((r, f) => f.eq(r.estado, row.estado))
          .returning('id')
          .build(),
      );
      if (!updated[0])
        throw new ConflictException(
          'La sanción cambió durante el levantamiento.',
        );
      await this.audit(
        tx,
        row.usuarioId,
        'SUSPENSION_LEVANTADA',
        resolution,
        actor,
        { sanctionId: id, ...before },
        {
          sanctionId: id,
          status: 'FINALIZADA',
          startsAt,
          endsAt: now,
          trustRestored: false,
        },
        now,
      );
      await this.rechain(tx, row.usuarioId, id, now, actor, resolution);
      return (await this.detail(id, tx))!;
    });
  }

  private async rechain(
    tx: Runtime,
    userId: string,
    liftedId: string,
    now: Date,
    actor: AuditActor,
    reason: string,
  ) {
    const rows = await tx.query(
      this.sanctions()
        .where((r, f) => f.eq(r.usuarioId, userId))
        .orderBy((r) => r.fechaInicio, { direction: 'asc' })
        .orderBy((r) => r.id, { direction: 'asc' })
        .build(),
    );
    let cursor = now.getTime();
    for (const row of rows) {
      const s = this.schedule(row);
      if (effectiveSanctionStatus(s, now) === 'ACTIVA' && s.endsAt)
        cursor = Math.max(cursor, s.endsAt.getTime());
    }
    for (const row of rows) {
      const s = this.schedule(row);
      if (effectiveSanctionStatus(s, now) !== 'PROGRAMADA' || s.endsAt === null)
        continue;
      const duration = s.endsAt.getTime() - s.startsAt.getTime();
      if (duration <= 0)
        throw new ConflictException('Calendario programado inconsistente.');
      const startsAt = new Date(cursor),
        endsAt = new Date(cursor + duration);
      if (!Number.isFinite(endsAt.getTime()))
        throw new ConflictException('El calendario excede el rango permitido.');
      const status = cursor > now.getTime() ? 'PROGRAMADA' : 'ACTIVA';
      await tx.query(
        this.prisma.sql.public.sanciones
          .update({
            estado: status,
            fechaInicio: this.instant(startsAt),
            fechaFin: this.instant(endsAt),
          })
          .where((r, f) => f.eq(r.id, row.id))
          .build(),
      );
      await this.audit(
        tx,
        userId,
        'SUSPENSION_REPROGRAMADA',
        reason,
        actor,
        { sanctionId: row.id, ...s },
        {
          sanctionId: row.id,
          liftedSanctionId: liftedId,
          status,
          startsAt,
          endsAt,
        },
        now,
      );
      cursor = endsAt.getTime();
    }
  }
}
