import {
  lockLoanInventory,
  LoanInventoryContentionException,
} from '../../../../../shared/infrastructure/prisma/lock-loan-inventory.js';
import { createHash, randomUUID } from 'node:crypto';
import { assertLoanSchema, loanSchemaTransaction, requireLoanColumns, LOAN_OPERATION_SCHEMA } from '../../loan-schema.js';
import { SchemaCapabilityUnavailableException, type KnownSchemaCapabilities } from '../../../../../shared/infrastructure/prisma/schema-capabilities.js';
import { setTimeout as wait } from 'node:timers/promises';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import {
  instantToDate,
  nullableInstantToDate,
} from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import { LoanEpisodeEngine } from '../../../../rules/infrastructure/persistence/prisma/loan-episode.engine.js';
import type { RulesTransaction } from '../../../../rules/infrastructure/persistence/prisma/historical-loan-policy.reader.js';
import {
  crossedLateness,
  severityRank,
  type HistoricalLoanPolicy,
} from '../../../../rules/domain/loan-policy.js';
import { LoanStatus, type Loan } from '../../../domain/entities/loan.js';
import { inspectionParts } from '../../../domain/entities/return-inspection.js';
import {
  restoreClosedLoan,
  type CloseLoanData,
  type ClosureConsequence,
  type ClosureReward,
  type ReturnPolicy,
} from '../../../domain/entities/loan-closure.js';

const instant = (at: Date) => Temporal.Instant.from(at.toISOString());
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const json = (value: unknown): Json =>
  JSON.parse(JSON.stringify(value)) as Json;
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);

/** Orden canónico independiente del orden de propiedades, partes y evidencias. */
export function closureRequestHash(data: CloseLoanData): string {
  const body =
    'inspection' in data
      ? {
          reason: 'DEVOLUCION',
          inspection: {
            parts: [...data.inspection.parts]
              .sort((a, b) => a.accessoryId.localeCompare(b.accessoryId))
              .map((p) => ({
                accessoryId: p.accessoryId,
                received: p.received,
              })),
            condition: data.inspection.condition,
            damageSeverity: data.inspection.damageSeverity,
            description: data.inspection.description,
            evidenceIds: [...data.inspection.evidenceIds].sort(),
          },
          observation: data.observation,
        }
      : {
          reason: data.kind,
          confirmed: data.confirmed,
          description: data.description,
          evidenceIds: [...data.evidenceIds].sort(),
        };
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

export class PrismaLoanClosure {
  private readonly engine: LoanEpisodeEngine;
  constructor(private readonly prisma: PrismaService) {
    this.engine = new LoanEpisodeEngine(prisma);
  }

  private async policy(tx: RulesTransaction, loanId: string) {
    try {
      return await this.engine.readPolicy(tx, loanId);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException(
        'No se puede acreditar la política histórica del préstamo.',
      );
    }
  }

  private async snapshot(
    tx: RulesTransaction,
    loanId: string,
  ): Promise<Loan['configurationSnapshot']> {
    const sql = this.prisma.sql.public;
    const loan = (
      await tx.query(
        sql.prestamos
          .select('configurationSnapshot', 'reservaId')
          .where((r, f) => f.eq(r.id, loanId))
          .limit(1)
          .build(),
      )
    )[0];
    if (!loan) throw new NotFoundException('Préstamo no encontrado.');
    let snapshot = loan.configurationSnapshot as Loan['configurationSnapshot'];
    if (!Array.isArray(snapshot?.accessories) && loan.reservaId) {
      const reservation = (
        await tx.query(
          sql.reservas
            .select('configurationSnapshot')
            .where((r, f) => f.eq(r.id, loan.reservaId!))
            .limit(1)
            .build(),
        )
      )[0];
      snapshot =
        reservation?.configurationSnapshot as Loan['configurationSnapshot'];
    }
    if (
      !Array.isArray(snapshot?.accessories) ||
      snapshot.accessories.some(
        (a) => !a || typeof a.id !== 'string' || typeof a.nombre !== 'string',
      ) ||
      new Set(snapshot.accessories.map((a) => a.id)).size !==
        snapshot.accessories.length
    )
      throw new ServiceUnavailableException(
        'No se puede acreditar el snapshot histórico de componentes.',
      );
    return snapshot;
  }

  async readReturnPolicy(loanId: string): Promise<ReturnPolicy> {
    const read = async (snapshot: KnownSchemaCapabilities) => {
      requireLoanColumns(snapshot, 'incumplimientos', ['prestamoId', 'origen'], 'loans.returnPolicy');
      requireLoanColumns(snapshot, 'ajustes_incumplimiento', [
        'incumplimientoId', 'versionReglaId', 'severidad', 'descuentoEfectivo',
        'duracionTotalDias', 'fechaEfectiva',
      ], 'loans.returnPolicy');
      return this.resolveReturnPolicy(loanId);
    };
    try {
      return await this.prisma.schemaCapabilities.read('loanEpisodes', 'loans.returnPolicy', read, read);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw new ServiceUnavailableException(
        'No se puede resolver la política histórica de devolución.',
      );
    }
  }

  private async resolveReturnPolicy(loanId: string): Promise<ReturnPolicy> {
    const tx = this.prisma.client.runtime();
    const sql = this.prisma.sql.public;
    const loan = (
      await tx.query(
        sql.prestamos
          .select('fechaFin')
          .where((r, f) => f.eq(r.id, loanId))
          .limit(1)
          .build(),
      )
    )[0];
    if (!loan) throw new NotFoundException('Préstamo no encontrado.');
    const policy = await this.policy(tx, loanId);
    const snapshot = await this.snapshot(tx, loanId);
    const now = new Date();
    const due = instantToDate(loan.fechaFin);
    const episodes = await this.consequences(tx, loanId, policy);
    const current = episodes.find((e) => e.kind === 'LATENESS');
    const target = crossedLateness(policy, due, now).at(-1)?.policy;
    return {
      loanId,
      serverNow: now.toISOString(),
      endsAt: due.toISOString(),
      categoryId: policy.categoryId,
      termsVersionId: policy.termsVersionId,
      policySource: policy.policySource!,
      accessories: snapshot!.accessories.map((a) => ({
        id: a.id,
        nombre: a.nombre,
      })),
      damageOptions: policy.damageOptions.map((p) => ({
        ...p,
        versionId: p.id,
      })),
      lateness: {
        automatic: true,
        currentSeverity: current?.severity ?? null,
        targetSeverity: target?.severity ?? null,
        appliedPenaltyPoints: current?.effectivePenaltyTotal ?? 0,
        targetPenaltyPoints: target?.penaltyPoints ?? 0,
        targetSuspensionDays: target?.suspensionDays ?? 0,
      },
      lossPolicy: { ...policy.loss, versionId: policy.loss.id },
      rewardPolicy: { ...policy.reward, versionId: policy.reward.id },
    };
  }

  async close(data: CloseLoanData): Promise<Loan> {
    await assertLoanSchema(this.prisma, LOAN_OPERATION_SCHEMA, 'loans.close');
    const hash = closureRequestHash(data);
    // UUID canónico aunque el esquema conserve su almacenamiento textual único.
    const requestId = data.requestId.toLowerCase();
    for (let attempt = 0; ; attempt++) {
      // Solo resultados confirmados, incluso si otro escritor retiene la barrera.
      const previous = await this.readCommittedClosure(data, hash, requestId);
      if (previous) return previous;
      try {
        return await this.closeTransaction(data, hash, requestId);
      } catch (error) {
        if (!(error instanceof LoanInventoryContentionException)) throw error;
        // La transacción fallida ya terminó/retrocedió. Nunca esperar dentro de ella.
        if (attempt === 4) {
          const committed = await this.readCommittedClosure(data, hash, requestId);
          if (committed) return committed;
          throw new ServiceUnavailableException(
            'Contención temporal al cerrar el préstamo; reintente con la misma clave.',
            { cause: error },
          );
        }
        await wait(50 * (attempt + 1));
      }
    }
  }

  private async readCommittedClosure(data: CloseLoanData, hash: string, requestId: string) {
    const read = async (snapshot: KnownSchemaCapabilities) => {
      if (LOAN_OPERATION_SCHEMA.some((bundle) => !snapshot.bundles[bundle]))
        throw new SchemaCapabilityUnavailableException('loans.close', 'SCHEMA_INCOMPLETE');
      return this.previousClosure(this.prisma.client.runtime(), data, hash, requestId);
    };
    return this.prisma.schemaCapabilities.read('loanClosure', 'loans.close', read, read);
  }

  private async previousClosure(
    tx: RulesTransaction,
    data: CloseLoanData,
    hash: string,
    requestId: string,
  ): Promise<Loan | null> {
    const previous = (
      await tx.query(
        this.prisma.sql.public.cierres_prestamo
          .select(
            'prestamoId',
            'requestId',
            'requestHash',
            'actor',
            'resultado',
          )
          .where((r, f) => f.eq(r.requestId, requestId))
          .limit(1)
          .build(),
      )
    )[0];
    if (!previous) return null;
    const actor = previous.actor as { accountId?: string; userId?: string };
    if (
      previous.prestamoId !== data.loanId ||
      previous.requestHash !== hash ||
      actor.accountId !== data.actor.accountId ||
      actor.userId !== data.actor.userId
    )
      throw new ConflictException(
        'La solicitud ya fue usada con otro préstamo, actor o cuerpo.',
      );
    return restoreClosedLoan(previous.resultado);
  }

  private async closeTransaction(
    data: CloseLoanData,
    hash: string,
    requestId: string,
  ): Promise<Loan> {
    try {
      return await loanSchemaTransaction(this.prisma, LOAN_OPERATION_SCHEMA, 'loans.close', async (tx) => {
        await lockLoanInventory(this.prisma, tx);
        // Revalidar tras adquirir la barrera: pudo confirmarse desde la lectura externa.
        const previous = await this.previousClosure(tx, data, hash, requestId);
        if (previous) return previous;
        const sql = this.prisma.sql.public;
        // Lectura de titular exclusivamente para adquirir los bloqueos en orden común.
        const owner = (
          await tx.query(
            sql.prestamos
              .select('usuarioId')
              .where((r, f) => f.eq(r.id, data.loanId))
              .limit(1)
              .build(),
          )
        )[0];
        if (!owner) throw new NotFoundException('Préstamo no encontrado.');
        const user = (
          await tx.query(
            sql.usuarios
              .update({ id: owner.usuarioId })
              .where((r, f) => f.eq(r.id, owner.usuarioId))
              .returning('id', 'confianza')
              .build(),
          )
        )[0];
        if (!user) throw new NotFoundException('Usuario no encontrado.');
        const loan = (
          await tx.query(
            sql.prestamos
              .update({ id: data.loanId })
              .where((r, f) => f.eq(r.id, data.loanId))
              .returning(
                'id',
                'usuarioId',
                'ejemplarId',
                'fechaInicio',
                'fechaFin',
                'estado',
                'configurationSnapshot',
              )
              .build(),
          )
        )[0];
        if (!loan || loan.usuarioId !== owner.usuarioId)
          throw new ConflictException('El titular del préstamo cambió.');
        // Única captura del reloj, DESPUÉS de los dos bloqueos.
        const now = new Date();
        const closure = (
          await tx.query(
            sql.cierres_prestamo
              .select('id')
              .where((r, f) => f.eq(r.prestamoId, data.loanId))
              .limit(1)
              .build(),
          )
        )[0];
        const oldReturn = (
          await tx.query(
            sql.devoluciones
              .select('id')
              .where((r, f) => f.eq(r.prestamoId, data.loanId))
              .limit(1)
              .build(),
          )
        )[0];
        if (closure || oldReturn || loan.estado !== 'ACTIVO')
          throw new ConflictException(
            'El préstamo ya tiene cierre o no está activo.',
          );
        if (now < instantToDate(loan.fechaInicio))
          throw new ConflictException(
            'El cierre no puede preceder a la entrega.',
          );
        const policy = await this.policy(tx, data.loanId);
        const isReturn = 'inspection' in data;
        const snapshot = isReturn ? await this.snapshot(tx, data.loanId) : null;
        const parts = isReturn
          ? inspectionParts(snapshot ?? null, data.inspection.parts)
          : [];
        const missing = parts.some((p) => !p.received);
        const damaged = isReturn && data.inspection.condition === 'DANADO';
        const incident = missing || damaged;
        if (isReturn) {
          if (
            incident !== (data.inspection.damageSeverity !== undefined) ||
            (incident &&
              (!data.inspection.description?.trim() ||
                !['LEVE', 'MODERADA', 'GRAVE'].includes(
                  data.inspection.damageSeverity!,
                )))
          )
            throw new BadRequestException(
              'Daño o faltantes requieren gravedad y descripción; sin incidente se omite gravedad.',
            );
        } else if (data.confirmed !== true || !data.description.trim()) {
          throw new BadRequestException(
            'Confirme y describa la pérdida o robo.',
          );
        }
        const evidenceIds = isReturn
          ? data.inspection.evidenceIds
          : data.evidenceIds;
        const evidence = await tx.query(
          sql.evidencias_prestamo
            .select('id', 'tipo')
            .where((r, f) => f.eq(r.prestamoId, data.loanId))
            .build(),
        );
        if (
          new Set(evidenceIds).size !== evidenceIds.length ||
          evidenceIds.some(
            (id) =>
              !evidence.some(
                (e) =>
                  e.id === id &&
                  (isReturn
                    ? ['DEVOLUCION', 'DANO'].includes(e.tipo)
                    : e.tipo === 'PERDIDA'),
              ),
          )
        )
          throw new BadRequestException(
            'Evidencias inexistentes, duplicadas o ajenas al préstamo/tipo.',
          );
        const id = randomUUID();
        const finalInspection = isReturn
          ? {
              id,
              ...data.inspection,
              parts: parts.map((p) => ({
                accessoryId: p.accessoryId,
                received: p.received,
              })),
              evidenceIds: [...evidenceIds].sort(),
            }
          : null;
        const reason = isReturn ? ('DEVOLUCION' as const) : data.kind;
        // Inspección final persistida antes del motor, distinta del checklist antecedente.
        await tx.query(
          sql.cierres_prestamo
            .insert([
              {
                id,
                prestamoId: data.loanId,
                requestId,
                requestHash: hash,
                actor: json(data.actor),
                contexto: json({
                  reason,
                  categoryId: policy.categoryId,
                  termsVersionId: policy.termsVersionId,
                }),
                inspeccion: json(finalInspection),
                resultado: {},
                recompensa: null,
                fechaEfectiva: instant(now),
              },
            ])
            .returning('id')
            .build(),
        );
        const applied = await this.engine.synchronize(
          tx,
          {
            loanId: data.loanId,
            userId: loan.usuarioId,
            actor: data.actor,
            source: 'CLOSURE',
            effectiveAt: now,
            ...(isReturn
              ? incident
                ? {
                    damage: {
                      damageSeverity: damaged
                        ? data.inspection.damageSeverity!
                        : null,
                      missingSeverity: missing
                        ? data.inspection.damageSeverity!
                        : null,
                      inspectionId: id,
                      reason: data.inspection.description!,
                    },
                  }
                : {}
              : {
                  loss: {
                    condition: data.kind === 'PERDIDA' ? 'PERDIDO' : 'ROBADO',
                    reason: data.description,
                    evidenceIds,
                  },
                }),
          },
          now,
        );
        if (applied.stopped)
          throw new ConflictException('El préstamo ya no está activo.');
        const condition = !isReturn
          ? data.kind === 'PERDIDA'
            ? 'PERDIDO'
            : 'ROBADO'
          : damaged
            ? missing
              ? 'DANADO_E_INCOMPLETO'
              : 'DANADO'
            : missing
              ? 'INCOMPLETO'
              : 'APTO';
        const copy = (
          await tx.query(
            sql.ejemplares
              .update({ id: loan.ejemplarId })
              .where((r, f) => f.eq(r.id, loan.ejemplarId))
              .returning('id', 'recursoId', 'habilitado')
              .build(),
          )
        )[0];
        if (!copy)
          throw new ServiceUnavailableException('Ejemplar no encontrado.');
        const resource = (
          await tx.query(
            sql.recursos
              .update({ id: copy.recursoId })
              .where((r, f) => f.eq(r.id, copy.recursoId))
              .returning('activo', 'categoriaId')
              .build(),
          )
        )[0];
        if (!resource)
          throw new ServiceUnavailableException('Recurso no encontrado.');
        const category = (
          await tx.query(
            sql.categorias_recurso
              .update({ id: resource.categoriaId })
              .where((r, f) => f.eq(r.id, resource.categoriaId))
              .returning('activo')
              .build(),
          )
        )[0];
        if (!category)
          throw new ServiceUnavailableException('Categoría no encontrada.');
        const reservations = await tx.query(
          sql.reservas
            .select('id')
            .where((r, f) => f.eq(r.ejemplarId, copy.id))
            .where((r, f) => f.eq(r.estado, 'CONFIRMADA'))
            .build(),
        );
        const otherLoans = await tx.query(
          sql.prestamos
            .select('id')
            .where((r, f) => f.eq(r.ejemplarId, copy.id))
            .where((r, f) => f.in(r.estado, ['ACTIVO', 'PLANIFICADO']))
            .build(),
        );
        const available =
          condition === 'APTO' &&
          copy.habilitado &&
          resource.activo &&
          category.activo &&
          !reservations.length &&
          !otherLoans.some((l) => l.id !== loan.id);
        const estado = available ? 'DISPONIBLE' : 'NO_DISPONIBLE';
        await tx.query(
          sql.ejemplares
            .update({ estado, condicionFisica: condition })
            .where((r, f) => f.eq(r.id, copy.id))
            .build(),
        );
        let returned: Loan['return'] = null;
        if (isReturn) {
          const row = (
            await tx.query(
              sql.devoluciones
                .insert([
                  {
                    prestamoId: loan.id,
                    fecha: instant(now),
                    observacion: data.observation ?? null,
                  },
                ])
                .returning('id')
                .build(),
            )
          )[0];
          returned = {
            id: row.id,
            loanId: loan.id,
            returnedAt: now,
            observation: data.observation ?? null,
          };
        }
        const reward = isReturn
          ? this.reward(
              policy,
              applied.resultingTrust,
              incident,
              now > instantToDate(loan.fechaFin),
            )
          : null;
        if (reward)
          await tx.query(
            sql.usuarios
              .update({ confianza: reward.resultingTrust.toFixed(2) })
              .where((r, f) => f.eq(r.id, loan.usuarioId))
              .build(),
          );
        const status = isReturn
          ? LoanStatus.COMPLETED
          : LoanStatus.CLOSED_INCIDENT;
        await tx.query(
          sql.prestamos
            .update({ estado: status })
            .where((r, f) => f.eq(r.id, loan.id))
            .build(),
        );
        const antecedent = (
          await tx.query(
            sql.inspecciones_devolucion
              .select(
                'id',
                'prestamoId',
                'actorId',
                'checkedAt',
                'configurationSnapshot',
                'parts',
              )
              .where((r, f) => f.eq(r.prestamoId, loan.id))
              .limit(1)
              .build(),
          )
        )[0];
        const result: Loan = {
          closureHistory: 'AVAILABLE',
          id: loan.id,
          userId: loan.usuarioId,
          copyId: loan.ejemplarId,
          startsAt: instantToDate(loan.fechaInicio),
          endsAt: instantToDate(loan.fechaFin),
          status,
          return: returned,
          // Proyección acreditada usada en la inspección; el snapshot original
          // del préstamo permanece intacto en persistencia.
          configurationSnapshot: snapshot ?? await this.snapshot(tx, loan.id),
          returnChecklist: antecedent
            ? {
                id: antecedent.id,
                loanId: antecedent.prestamoId,
                actorId: antecedent.actorId,
                checkedAt: instantToDate(antecedent.checkedAt),
                configurationSnapshot:
                  (antecedent.configurationSnapshot as Loan['configurationSnapshot']) ??
                  null,
                parts: antecedent.parts as unknown as NonNullable<
                  Loan['returnChecklist']
                >['parts'],
              }
            : null,
          closure: {
            id,
            requestId,
            reason,
            effectiveAt: now.toISOString(),
            actorAccountId: data.actor.accountId,
            actorUserId: data.actor.userId,
            categoryId: policy.categoryId,
            termsVersionId: policy.termsVersionId,
            inspection: finalInspection,
          },
          consequences: await this.consequences(tx, loan.id, policy),
          reward,
          copy: {
            id: copy.id,
            estado,
            condicionFisica: condition,
            habilitado: copy.habilitado,
          },
          cancelledReservationIds: applied.cancelledReservationIds,
        };
        await tx.query(
          sql.cierres_prestamo
            .update({ resultado: json(result), recompensa: json(reward) })
            .where((r, f) => f.eq(r.id, id))
            .build(),
        );
        await tx.query(
          sql.auditorias_usuario
            .insert([
              {
                usuarioId: loan.usuarioId,
                accion: 'PRESTAMO_CERRADO',
                motivo: reason,
                datosAnteriores: JSON.stringify({
                  estado: loan.estado,
                  confianza: Number(user.confianza),
                }),
                datosNuevos: JSON.stringify({ ...result, actor: data.actor }),
                fecha: instant(now),
              },
            ])
            .returning('id')
            .build(),
        );
        return result;
      });
    } catch (error) {
      // La unicidad global también resuelve claves concurrentes en préstamos diferentes.
      if (this.uniqueViolation(error))
        throw new ConflictException(
          'La solicitud o el préstamo ya tienen cierre.',
        );
      throw error;
    }
  }

  private uniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const e = error as { code?: string; cause?: unknown };
    return (
      e.code === '23505' ||
      e.code === 'P2002' ||
      (e.cause !== error && this.uniqueViolation(e.cause))
    );
  }

  private reward(
    policy: HistoricalLoanPolicy,
    balance: number,
    incident: boolean,
    late: boolean,
  ): ClosureReward {
    const criteria = policy.reward.criteria.reward!;
    const eligible = !incident && !late;
    const calculated = eligible
      ? cents(criteria.referencePoints * criteria.fraction)
      : 0;
    const effective = Math.min(calculated, Math.max(0, 10000 - cents(balance)));
    return {
      eligible,
      reason: incident ? 'INCIDENTE' : late ? 'MORA' : 'PUNTUAL_Y_COMPLETO',
      ruleVersionId: policy.reward.id,
      referencePoints: criteria.referencePoints,
      fraction: criteria.fraction,
      calculatedPoints: calculated / 100,
      effectivePoints: effective / 100,
      previousTrust: balance,
      resultingTrust: (cents(balance) + effective) / 100,
    };
  }

  private async consequences(
    tx: RulesTransaction,
    loanId: string,
    policy: HistoricalLoanPolicy,
  ): Promise<ClosureConsequence[]> {
    const sql = this.prisma.sql.public;
    const episodes = await tx.query(
      sql.incumplimientos
        .select('id', 'origen')
        .where((r, f) => f.eq(r.prestamoId, loanId))
        .build(),
    );
    const result: ClosureConsequence[] = [];
    for (const episode of episodes) {
      const sanction = (
        await tx.query(
          sql.sanciones
            .select('id', 'fechaInicio', 'fechaFin')
            .where((r, f) => f.eq(r.incumplimientoId, episode.id))
            .limit(1)
            .build(),
        )
      )[0];
      const adjustments = await tx.query(
        sql.ajustes_incumplimiento
          .select(
            'versionReglaId',
            'severidad',
            'descuentoEfectivo',
            'duracionTotalDias',
            'fechaEfectiva',
          )
          .where((r, f) => f.eq(r.incumplimientoId, episode.id))
          .build(),
      );
      const latest = [...adjustments].sort(
        (a, b) =>
          instantToDate(b.fechaEfectiva).getTime() -
            instantToDate(a.fechaEfectiva).getTime() ||
          severityRank(b.severidad) - severityRank(a.severidad),
      )[0];
      if (!sanction || !latest)
        throw new ServiceUnavailableException(
          'Episodio sin sanción/ajustes acreditados.',
        );
      const rule = [
        ...policy.lateness,
        ...policy.damageOptions,
        policy.loss,
      ].find((p) => p.id === latest.versionReglaId);
      if (!rule)
        throw new ServiceUnavailableException(
          'Versión del episodio fuera de la publicación histórica.',
        );
      result.push({
        violationId: episode.id,
        sanctionId: sanction.id,
        kind: rule.kind,
        severity: rule.severity,
        ruleVersionId: rule.id,
        configuredPenaltyPoints: rule.penaltyPoints,
        effectivePenaltyTotal:
          cents(
            adjustments.reduce((n, a) => n + Number(a.descuentoEfectivo), 0),
          ) / 100,
        suspensionType: rule.suspensionType!,
        suspensionDays: latest.duracionTotalDias,
        startsAt: instantToDate(sanction.fechaInicio).toISOString(),
        endsAt: nullableInstantToDate(sanction.fechaFin)?.toISOString() ?? null,
      });
    }
    return result.sort((a, b) => a.kind.localeCompare(b.kind));
  }
}
