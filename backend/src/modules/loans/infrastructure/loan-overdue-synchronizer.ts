import { lockLoanInventory } from '../../../shared/infrastructure/prisma/lock-loan-inventory.js';
import { assertLoanSchema, loanSchemaTransaction, SANCTION_OPERATION_SCHEMA } from './loan-schema.js';
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { LoanEpisodeEngine } from '../../rules/infrastructure/persistence/prisma/loan-episode.engine.js';
import type { RulesTransaction } from '../../rules/infrastructure/persistence/prisma/historical-loan-policy.reader.js';
import { hasEffectiveUserRestriction } from '../../rules/infrastructure/persistence/prisma/effective-user-restriction.js';
import { PrismaSanctionRepository } from '../../rules/infrastructure/persistence/prisma/prisma-sanction.repository.js';
import { HistoricalLoanPolicyReader } from '../../rules/infrastructure/persistence/prisma/historical-loan-policy.reader.js';
import {
  crossedLateness,
  severityRank,
} from '../../rules/domain/loan-policy.js';
import { instantToDate } from '../../../shared/infrastructure/prisma/instant-to-date.js';

const instant = (at: Date) => Temporal.Instant.from(at.toISOString());
// Presupuesto de unidades con trabajo pendiente, no cupo de préstamos activos.
// Lo aplicado se confirma antes de denegar; el siguiente intento omite saldados.
const USER_WORK_LIMIT = 100;
const USER_PAGE_SIZE = 25;

@Injectable()
export class LoanOverdueSynchronizer {
  constructor(private readonly prisma: PrismaService) {}

  async assertAvailable(): Promise<void> {
    await assertLoanSchema(this.prisma, SANCTION_OPERATION_SCHEMA, 'loans.synchronizeOverdue');
  }

  async candidates(
    at: Date,
    limit: number,
    after: string | null = null,
    userId?: string,
  ) {
    return this.prisma.client
      .runtime()
      .query(this.due(at, limit, after, userId).build());
  }

  private due(at: Date, limit: number, after: string | null, userId?: string) {
    let query = this.prisma.sql.public.prestamos
      .select('id', 'usuarioId')
      .where((r, f) => f.eq(r.estado, 'ACTIVO'))
      .where((r, f) => f.lt(r.fechaFin, instant(at)));
    if (after) query = query.where((r, f) => f.gt(r.id, after));
    if (userId) query = query.where((r, f) => f.eq(r.usuarioId, userId));
    return query.orderBy((r) => r.id, { direction: 'asc' }).limit(limit);
  }

  async lockUser(tx: RulesTransaction, userId: string): Promise<void> {
    await assertLoanSchema(this.prisma, SANCTION_OPERATION_SCHEMA, 'loans.synchronizeOverdue', tx);
    await lockLoanInventory(this.prisma, tx);
    const rows = await tx.query(
      this.prisma.sql.public.usuarios
        .update({ id: userId })
        .where((r, f) => f.eq(r.id, userId))
        .returning('id')
        .build(),
    );
    if (!rows[0]) throw new ConflictException('Usuario no encontrado.');
  }

  private async synchronizeLockedLoan(
    tx: RulesTransaction,
    userId: string,
    loanId: string,
  ) {
    // Capturar el reloj DESPUÉS de ambos bloqueos. El motor repite el mismo orden.
    await tx.query(
      this.prisma.sql.public.prestamos
        .update({ id: loanId })
        .where((r, f) => f.eq(r.id, loanId))
        .where((r, f) => f.eq(r.usuarioId, userId))
        .returning('id')
        .build(),
    );
    await new LoanEpisodeEngine(this.prisma).synchronize(
      tx,
      {
        userId,
        loanId,
        source: 'AUTOMATION',
        actor: { process: 'loan-overdue-synchronizer' },
      },
      new Date(),
    );
  }

  async synchronizeLoan(userId: string, loanId: string): Promise<void> {
    await loanSchemaTransaction(this.prisma, SANCTION_OPERATION_SCHEMA, 'loans.synchronizeOverdue', async (tx) => {
      await lockLoanInventory(this.prisma, tx);
      await this.lockUser(tx, userId);
      await this.synchronizeLockedLoan(tx, userId, loanId);
    });
  }

  /** Fase confirmada independiente: una transacción por préstamo. */
  async synchronizeUser(userId: string): Promise<void> {
    await this.assertAvailable();
    const at = new Date();
    let after: string | null = null;
    let work = 0;
    let pending = false;
    let hasMore: boolean;
    do {
      const rows = await this.candidates(at, USER_PAGE_SIZE, after, userId);
      for (const row of rows) {
        const result = await loanSchemaTransaction(this.prisma, SANCTION_OPERATION_SCHEMA, 'loans.synchronizeOverdue', async (tx) => {
          await this.lockUser(tx, userId);
          return this.synchronizePending(tx, userId, row.id, work);
        });
        if (result === 'PENDING') {
          pending = true;
          break;
        }
        if (result === 'APPLIED') work++;
        after = row.id;
      }
      hasMore = !pending && rows.length === USER_PAGE_SIZE;
    } while (hasMore);
    await loanSchemaTransaction(this.prisma, SANCTION_OPERATION_SCHEMA, 'loans.synchronizeOverdue', async (tx) => {
      await lockLoanInventory(this.prisma, tx);
      await this.lockUser(tx, userId);
      await this.cancelRestricted(tx, userId, new Date());
    });
    if (pending) throw this.pendingError();
  }

  /** Usuario ya bloqueado. Cierra la carrera entre la fase previa y la operación.
   * El llamador confirma este resultado y SOLO DESPUÉS relanza la denegación. */
  async recheckLocked(
    tx: RulesTransaction,
    userId: string,
  ): Promise<ConflictException | ServiceUnavailableException | null> {
    await assertLoanSchema(this.prisma, SANCTION_OPERATION_SCHEMA, 'loans.synchronizeOverdue', tx);
    const at = new Date();
    let after: string | null = null;
    let work = 0;
    let hasMore: boolean;
    do {
      const rows: { id: string; usuarioId: string }[] = await tx.query(
        this.due(at, USER_PAGE_SIZE, after, userId).build(),
      );
      for (const row of rows) {
        const result = await this.synchronizePending(tx, userId, row.id, work);
        if (result === 'PENDING') {
          await this.cancelRestricted(tx, userId, new Date());
          // Devolver, no lanzar: el coordinador confirma los ajustes anteriores.
          return this.pendingError();
        }
        if (result === 'APPLIED') work++;
        after = row.id;
      }
      hasMore = rows.length === USER_PAGE_SIZE;
    } while (hasMore);
    return this.cancelRestricted(tx, userId, new Date());
  }

  private pendingError() {
    return new ServiceUnavailableException(
      'Quedan préstamos pendientes de reevaluación. Reintente la operación.',
    );
  }

  private async synchronizePending(
    tx: RulesTransaction,
    userId: string,
    loanId: string,
    work: number,
  ): Promise<'SETTLED' | 'APPLIED' | 'PENDING'> {
    if (!(await this.hasPending(tx, userId, loanId, new Date())))
      return 'SETTLED';
    if (work >= USER_WORK_LIMIT) return 'PENDING';
    await this.synchronizeLockedLoan(tx, userId, loanId);
    return 'APPLIED';
  }

  /** Comprobación persistida, sin cursor/cache de elegibilidad. Debe conservar
   * las reglas de idempotencia de LoanEpisodeEngine.apply; los datos dudosos
   * se remiten al motor para que valide o falle cerrado, nunca habilitan. */
  private async hasPending(
    tx: RulesTransaction,
    userId: string,
    loanId: string,
    at: Date,
  ): Promise<boolean> {
    const sql = this.prisma.sql.public;
    const loan = (
      await tx.query(
        sql.prestamos
          .select('estado', 'fechaFin', 'configurationSnapshot', 'reservaId')
          .where((r, f) => f.eq(r.id, loanId))
          .where((r, f) => f.eq(r.usuarioId, userId))
          .limit(1)
          .build(),
      )
    )[0];
    if (!loan || loan.estado !== 'ACTIVO') return false;
    const loss = (
      await tx.query(
        sql.incumplimientos
          .select('fecha')
          .where((r, f) => f.eq(r.prestamoId, loanId))
          .where((r, f) => f.eq(r.origen, 'PERDIDA'))
          .limit(1)
          .build(),
      )
    )[0];
    const effectiveAt = loss
      ? new Date(Math.min(at.getTime(), instantToDate(loss.fecha).getTime()))
      : at;
    const policy = await new HistoricalLoanPolicyReader(this.prisma).read(tx, {
      snapshot: loan.configurationSnapshot,
      reservationId: loan.reservaId,
    });
    const steps = crossedLateness(
      policy,
      instantToDate(loan.fechaFin),
      effectiveAt,
    );
    if (!steps.length) return false;
    const episode = (
      await tx.query(
        sql.incumplimientos
          .select('id', 'termsVersionId', 'categoriaId')
          .where((r, f) => f.eq(r.prestamoId, loanId))
          .where((r, f) => f.eq(r.origen, 'MORA'))
          .limit(1)
          .build(),
      )
    )[0];
    if (
      !episode ||
      episode.termsVersionId !== policy.termsVersionId ||
      episode.categoriaId !== policy.categoryId
    )
      return true;
    const adjustments = await tx.query(
      sql.ajustes_incumplimiento
        .select('versionReglaId', 'severidad', 'efecto')
        .where((r, f) => f.eq(r.incumplimientoId, episode.id))
        .build(),
    );
    const sanction = (
      await tx.query(
        sql.sanciones
          .select('estado')
          .where((r, f) => f.eq(r.usuarioId, userId))
          .where((r, f) => f.eq(r.incumplimientoId, episode.id))
          .limit(1)
          .build(),
      )
    )[0];
    if (!sanction || !adjustments.length) return true;
    if (sanction.estado === 'ABSUELTA') return false;
    return steps.some(({ policy: step }) => {
      const severity = step.severity ?? 'UNICA';
      return !adjustments.some(
        (a) =>
          a.efecto === 'SET_ZERO' ||
          (a.versionReglaId === step.id && a.severidad === severity) ||
          (severityRank(a.severidad) >= 0 &&
            severityRank(a.severidad) > severityRank(severity)),
      );
    });
  }

  private async cancelRestricted(
    tx: RulesTransaction,
    userId: string,
    at: Date,
  ) {
    const suspended = await hasEffectiveUserRestriction(
      this.prisma,
      tx,
      userId,
      at,
    );
    await new PrismaSanctionRepository(this.prisma).cancelReservations(
      tx,
      userId,
      'Restricción efectiva al reevaluar préstamos',
      at,
    );
    return suspended
      ? new ConflictException('El usuario tiene una sanción activa.')
      : null;
  }
}
