import { assertLoanSchema, LOAN_OPERATION_SCHEMA, SANCTION_OPERATION_SCHEMA } from '../../../../loans/infrastructure/loan-schema.js';
import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type { AuditActor } from '../../../../../shared/application/audit-actor.js';
import {
  instantToDate,
  nullableInstantToDate,
} from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import type { PublicPolicy } from '../../../domain/entities/public-terms.js';
import type { Severity } from '../../../domain/official-policy.catalog.js';
import {
  aggregateDamage,
  crossedLateness,
  severityRank,
  type HistoricalLoanPolicy,
} from '../../../domain/loan-policy.js';
import { episodeAdjustment } from '../../../domain/episode-adjustment.js';
import {
  extendEpisodeCalendar,
  type CalendarEntry,
} from '../../../domain/episode-calendar.js';
import {
  HistoricalLoanPolicyReader,
  type RulesTransaction,
} from './historical-loan-policy.reader.js';
import { PrismaSanctionRepository } from './prisma-sanction.repository.js';
import { lockLoanInventory } from '../../../../../shared/infrastructure/prisma/lock-loan-inventory.js';

export type EpisodeActor = AuditActor | { process: string };
export interface SynchronizeLoanEpisodes {
  userId: string;
  loanId: string;
  actor: EpisodeActor;
  source: 'CLOSURE' | 'AUTOMATION';
  /** Instante real del cierre; por defecto el tiempo capturado por el llamador. */
  effectiveAt?: Date;
  damage?: {
    damageSeverity: Severity | null;
    missingSeverity: Severity | null;
    inspectionId: string;
    reason: string;
  };
  loss?: {
    condition: 'PERDIDO' | 'ROBADO';
    reason: string;
    evidenceIds: string[];
  };
}
export interface LoanEpisodeResult {
  adjustmentIds: string[];
  sanctionIds: string[];
  cancelledReservationIds: string[];
  resultingTrust: number;
  stopped: 'LOAN_CLOSED' | null;
}
type Origin = 'MORA' | 'DANO' | 'PERDIDA';
type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
const instant = (at: Date) => Temporal.Instant.from(at.toISOString());
const json = (value: unknown): JsonValue =>
  JSON.parse(JSON.stringify(value)) as JsonValue;

/** No abre transacción, no captura reloj y no devuelve/repara ejemplares.
 * Orden: barrera de inventario/publicación -> usuario -> préstamo ->
 * episodios/calendario/copias. La barrera es reentrante para coordinadores.
 */
export class LoanEpisodeEngine {
  constructor(private readonly prisma: PrismaService) {}

  async readPolicy(
    tx: RulesTransaction,
    loanId: string,
  ): Promise<HistoricalLoanPolicy> {
    const row = (
      await tx.query(
        this.prisma.sql.public.prestamos
          .select('configurationSnapshot', 'reservaId')
          .where((r, f) => f.eq(r.id, loanId))
          .limit(1)
          .build(),
      )
    )[0];
    if (!row) throw new NotFoundException('Préstamo no encontrado.');
    return new HistoricalLoanPolicyReader(this.prisma).read(tx, {
      snapshot: row.configurationSnapshot,
      reservationId: row.reservaId,
    });
  }

  async synchronize(
    tx: RulesTransaction,
    data: SynchronizeLoanEpisodes,
    at: Date,
  ): Promise<LoanEpisodeResult> {
    await assertLoanSchema(this.prisma, data.damage ? LOAN_OPERATION_SCHEMA : SANCTION_OPERATION_SCHEMA, 'episodes.synchronize', tx);
    await lockLoanInventory(this.prisma, tx);
    const effectiveAt = data.effectiveAt ?? at;
    if (
      !Number.isFinite(at.getTime()) ||
      !Number.isFinite(effectiveAt.getTime()) ||
      effectiveAt > at
    )
      throw new ConflictException('El instante efectivo no puede ser futuro.');
    if (data.loss && data.damage)
      throw new ConflictException(
        'Pérdida/robo no duplica daño por el mismo hecho.',
      );
    if (
      (data.damage || data.loss) &&
      (data.source !== 'CLOSURE' || !('accountId' in data.actor))
    )
      throw new ConflictException(
        'Daño y pérdida requieren un cierre con actor verificado.',
      );
    const user = (
      await tx.query(
        this.prisma.sql.public.usuarios
          .update({ id: data.userId })
          .where((r, f) => f.eq(r.id, data.userId))
          .returning('id', 'confianza')
          .build(),
      )
    )[0];
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const result: LoanEpisodeResult = {
      adjustmentIds: [],
      sanctionIds: [],
      cancelledReservationIds: [],
      resultingTrust: Number(user.confianza),
      stopped: null,
    };
    const loan = (
      await tx.query(
        this.prisma.sql.public.prestamos
          .update({ id: data.loanId })
          .where((r, f) => f.eq(r.id, data.loanId))
          .where((r, f) => f.eq(r.usuarioId, data.userId))
          .returning(
            'id',
            'estado',
            'fechaInicio',
            'fechaFin',
            'reservaId',
            'configurationSnapshot',
          )
          .build(),
      )
    )[0];
    if (!loan)
      throw new NotFoundException('Préstamo del usuario no encontrado.');
    if (loan.estado !== 'ACTIVO') return { ...result, stopped: 'LOAN_CLOSED' };
    if (effectiveAt < instantToDate(loan.fechaInicio))
      throw new ConflictException('El cierre no puede preceder a la entrega.');
    const confirmedLoss = (
      await tx.query(
        this.prisma.sql.public.incumplimientos
          .select('fecha')
          .where((r, f) => f.eq(r.prestamoId, data.loanId))
          .where((r, f) => f.eq(r.origen, 'PERDIDA'))
          .limit(1)
          .build(),
      )
    )[0];
    if (confirmedLoss && data.damage)
      throw new ConflictException(
        'La pérdida confirmada no admite daño del mismo préstamo.',
      );
    const latenessAt = confirmedLoss
      ? new Date(
          Math.min(
            effectiveAt.getTime(),
            instantToDate(confirmedLoss.fecha).getTime(),
          ),
        )
      : effectiveAt;
    const policy = await new HistoricalLoanPolicyReader(this.prisma).read(tx, {
      snapshot: loan.configurationSnapshot,
      reservationId: loan.reservaId,
    });
    if (data.damage) {
      if (!data.damage.reason.trim())
        throw new ConflictException('El daño requiere fundamento.');
      const finalClosure = (
        await tx.query(
          this.prisma.sql.public.cierres_prestamo
            .select('inspeccion')
            .where((r, f) => f.eq(r.id, data.damage!.inspectionId))
            .where((r, f) => f.eq(r.prestamoId, data.loanId))
            .limit(1).build(),
        )
      )[0];
      const finalInspection = finalClosure?.inspeccion;
      const inspection = finalClosure
        ? (finalInspection && typeof finalInspection === 'object' && !Array.isArray(finalInspection)
          && 'id' in finalInspection && finalInspection.id === data.damage.inspectionId
          ? finalInspection : null)
        : (
        await tx.query(
          this.prisma.sql.public.inspecciones_devolucion
            .select('id', 'parts')
            .where((r, f) => f.eq(r.id, data.damage!.inspectionId))
            .where((r, f) => f.eq(r.prestamoId, data.loanId))
            .limit(1)
            .build(),
        )
      )[0];
      if (!inspection)
        throw new ConflictException(
          'Falta inspección persistida del préstamo.',
        );
      if (!('parts' in inspection) || !Array.isArray(inspection.parts))
        throw new ConflictException(
          'La inspección no tiene un checklist acreditado.',
        );
      const hasMissingParts = inspection.parts.some(
        (p: unknown) =>
          p && typeof p === 'object' && 'received' in p && p.received === false,
      );
      if (hasMissingParts !== (data.damage.missingSeverity !== null))
        throw new ConflictException(
          'La gravedad de faltantes debe corresponder al checklist inspeccionado.',
        );
      if (finalClosure) {
        const final = inspection as Record<string, unknown>;
        if (
          !['SANO', 'DESGASTE_NORMAL', 'DANADO'].includes(String(final.condition)) ||
          data.damage.damageSeverity !== (final.condition === 'DANADO' ? final.damageSeverity : null) ||
          data.damage.missingSeverity !== (hasMissingParts ? final.damageSeverity : null) ||
          final.description !== data.damage.reason
        ) throw new ConflictException('El daño no coincide con la inspección final persistida.');
      }
    }
    if (data.loss) {
      if (
        !['PERDIDO', 'ROBADO'].includes(data.loss.condition) ||
        !data.loss.reason.trim() ||
        new Set(data.loss.evidenceIds).size !== data.loss.evidenceIds.length
      )
        throw new ConflictException(
          'La pérdida/robo requiere fundamento y evidencia.',
        );
      const evidence = await tx.query(
        this.prisma.sql.public.evidencias_prestamo
          .select('id', 'tipo')
          .where((r, f) => f.eq(r.prestamoId, data.loanId))
          .build(),
      );
      if (
        data.loss.evidenceIds.some(
          (id) => !evidence.some((e) => e.id === id && e.tipo === 'PERDIDA'),
        )
      )
        throw new ConflictException(
          'Evidencia de pérdida no acreditada para este préstamo.',
        );
    }
    const steps: { origin: Origin; policy: PublicPolicy; effectiveAt: Date }[] =
      crossedLateness(policy, instantToDate(loan.fechaFin), latenessAt).map(
        (step) => ({ ...step, origin: 'MORA' }),
      );
    const damage =
      data.damage &&
      aggregateDamage(
        policy,
        data.damage.damageSeverity,
        data.damage.missingSeverity,
      );
    if (damage) steps.push({ origin: 'DANO', policy: damage, effectiveAt });
    if (data.loss)
      steps.push({ origin: 'PERDIDA', policy: policy.loss, effectiveAt });
    for (const step of steps) {
      const applied = await this.apply(
        tx,
        data,
        policy,
        step,
        result.resultingTrust,
        at,
      );
      if (!applied) continue;
      result.adjustmentIds.push(applied.adjustmentId);
      if (!result.sanctionIds.includes(applied.sanctionId))
        result.sanctionIds.push(applied.sanctionId);
      result.resultingTrust = applied.balance;
    }
    result.cancelledReservationIds = await new PrismaSanctionRepository(
        this.prisma,
      ).cancelReservations(
        tx,
        data.userId,
        `Episodio de préstamo ${data.loanId}`,
        at,
      );
    return result;
  }

  private async apply(
    tx: RulesTransaction,
    data: SynchronizeLoanEpisodes,
    reference: HistoricalLoanPolicy,
    step: { origin: Origin; policy: PublicPolicy; effectiveAt: Date },
    balance: number,
    registeredAt: Date,
  ): Promise<{
    adjustmentId: string;
    sanctionId: string;
    balance: number;
  } | null> {
    const sql = this.prisma.sql.public;
    const episode = (
      await tx.query(
        sql.incumplimientos
          .select('id', 'termsVersionId', 'categoriaId')
          .where((r, f) => f.eq(r.prestamoId, data.loanId))
          .where((r, f) => f.eq(r.origen, step.origin))
          .limit(1)
          .build(),
      )
    )[0];
    if (
      episode &&
      (episode.termsVersionId !== reference.termsVersionId ||
        episode.categoriaId !== reference.categoryId)
    )
      throw new ConflictException(
        'El episodio ya pertenece a otro contexto histórico.',
      );
    const adjustments = episode
      ? await tx.query(
          sql.ajustes_incumplimiento
            .select(
              'versionReglaId',
              'severidad',
              'efecto',
              'nominalObjetivo',
              'duracionTotalDias',
              'fechaEfectiva',
            )
            .where((r, f) => f.eq(r.incumplimientoId, episode.id))
            .build(),
        )
      : [];
    const severity = step.policy.severity ?? 'UNICA';
    if (
      adjustments.some(
        (a) =>
          a.efecto === 'SET_ZERO' ||
          (a.versionReglaId === step.policy.id && a.severidad === severity) ||
          (severityRank(a.severidad) >= 0 &&
            severityRank(a.severidad) > severityRank(severity)),
      )
    )
      return null;
    const sanctions = await tx.query(
      sql.sanciones
        .select('id', 'incumplimientoId', 'estado', 'fechaInicio', 'fechaFin')
        .where((r, f) => f.eq(r.usuarioId, data.userId))
        .build(),
    );
    const existing =
      episode && sanctions.find((s) => s.incumplimientoId === episode.id);
    if (episode && !existing)
      throw new ConflictException('El episodio no tiene sanción.');
    if (existing?.estado === 'ABSUELTA') return null;
    if (episode && !adjustments.length)
      throw new ConflictException(
        'El episodio histórico no tiene ajustes acreditados.',
      );
    if (
      adjustments.some((a) => instantToDate(a.fechaEfectiva) > step.effectiveAt)
    )
      throw new ConflictException(
        'El cierre precede a un ajuste ya registrado.',
      );
    const nominalReached = Math.max(
      0,
      ...adjustments.map((a) => Number(a.nominalObjetivo ?? 0)),
    );
    const daysReached = Math.max(
      0,
      ...adjustments.map((a) => a.duracionTotalDias ?? 0),
    );
    const charge = episodeAdjustment(
      step.policy,
      balance,
      nominalReached,
      daysReached,
    );
    const violationId = episode?.id ?? randomUUID(),
      sanctionId = existing?.id ?? randomUUID();
    const facts = await tx.query(sql.incumplimientos.select('id', 'fecha')
      .where((r, f) => f.eq(r.usuarioId, data.userId)).build());
    const before: CalendarEntry[] = sanctions.map((s) => ({
      id: s.id,
      status: s.estado,
      startsAt: instantToDate(s.fechaInicio),
      endsAt: nullableInstantToDate(s.fechaFin),
      ...(facts.some((f) => f.id === s.incumplimientoId) ? {
        effectiveAt: instantToDate(facts.find((f) => f.id === s.incumplimientoId)!.fecha),
      } : {}),
    }));
    const after = extendEpisodeCalendar(
      before,
      sanctionId,
      charge.additionalDays,
      step.effectiveAt,
      registeredAt,
    );
    const schedule = after.find((s) => s.id === sanctionId)!;
    if (!episode) {
      await tx.query(
        sql.incumplimientos
          .insert([
            {
              id: violationId,
              usuarioId: data.userId,
              prestamoId: data.loanId,
              categoriaId: reference.categoryId,
              termsVersionId: reference.termsVersionId,
              origen: step.origin,
              reglaId: step.policy.ruleId,
              versionReglaId: step.policy.id,
              fecha: instant(step.effectiveAt),
              penalizacionAplicada: charge.effectiveDiscount.toFixed(2),
            },
          ])
          .returning('id')
          .build(),
      );
      await tx.query(
        sql.sanciones
          .insert([
            {
              id: sanctionId,
              usuarioId: data.userId,
              incumplimientoId: violationId,
              reglaId: step.policy.ruleId,
              versionReglaId: step.policy.id,
              estado: schedule.status,
              fechaInicio: instant(schedule.startsAt),
              fechaFin: schedule.endsAt ? instant(schedule.endsAt) : null,
              confianzaAnterior: balance.toFixed(2),
              confianzaPosterior: charge.resultingBalance.toFixed(2),
            },
          ])
          .returning('id')
          .build(),
      );
    }
    for (const entry of after) {
      const previous = before.find((s) => s.id === entry.id);
      if (!previous || JSON.stringify(previous) === JSON.stringify(entry))
        continue;
      await tx.query(
        sql.sanciones
          .update({
            estado: entry.status,
            fechaInicio: instant(entry.startsAt),
            fechaFin: entry.endsAt ? instant(entry.endsAt) : null,
          })
          .where((r, f) => f.eq(r.id, entry.id))
          .build(),
      );
    }
    const adjustmentId = randomUUID();
    await tx.query(
      sql.ajustes_incumplimiento
        .insert([
          {
            id: adjustmentId,
            incumplimientoId: violationId,
            versionReglaId: step.policy.id,
            severidad: severity,
            efecto: step.policy.trustEffect,
            nominalObjetivo: charge.nominalTarget?.toFixed(2) ?? null,
            incrementoNominal: charge.nominalIncrement?.toFixed(2) ?? null,
            descuentoEfectivo: charge.effectiveDiscount.toFixed(2),
            saldoAnterior: balance.toFixed(2),
            saldoPosterior: charge.resultingBalance.toFixed(2),
            duracionTotalDias: charge.totalDays,
            incrementoDias: charge.additionalDays,
            fechaEfectiva: instant(step.effectiveAt),
            actor: json(data.actor),
            contexto: json({
              source: data.source,
              loanId: data.loanId,
              origin: step.origin,
              termsVersionId: reference.termsVersionId,
              categoryId: reference.categoryId,
              damage: data.damage ?? null,
              loss: data.loss ?? null,
              registeredAt,
            }),
            calendarioAnterior: json(before),
            calendarioPosterior: json(after),
          },
        ])
        .returning('id')
        .build(),
    );
    await tx.query(
      sql.usuarios
        .update({ confianza: charge.resultingBalance.toFixed(2) })
        .where((r, f) => f.eq(r.id, data.userId))
        .build(),
    );
    await tx.query(
      sql.auditorias_usuario
        .insert([
          {
            usuarioId: data.userId,
            accion: 'EPISODIO_PRESTAMO_AJUSTADO',
            motivo: `Escala ${step.origin}: ${severity}`,
            datosAnteriores: JSON.stringify({
              confianza: balance,
              calendar: before,
            }),
            datosNuevos: JSON.stringify({
              adjustmentId,
              sanctionId,
              incumplimientoId: violationId,
              ruleVersionId: step.policy.id,
              confianza: charge.resultingBalance,
              calendar: after,
              actor: data.actor,
            }),
            fecha: instant(registeredAt),
          },
        ])
        .returning('id')
        .build(),
    );
    return { adjustmentId, sanctionId, balance: charge.resultingBalance };
  }
}
