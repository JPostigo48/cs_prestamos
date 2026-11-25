import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import { instantToDate } from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import {
  historicalLoanPolicy,
  type HistoricalLoanPolicy,
  type LoanPolicyReference,
} from '../../../domain/loan-policy.js';
import { PrismaTermsRepository } from './prisma-terms.repository.js';

export type RulesTransaction = Pick<
  ReturnType<PrismaService['client']['runtime']>,
  'query'
>;
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const text = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null;

export interface HistoricalLoanPolicyContext {
  snapshot: unknown;
  reservationId: string | null;
}

export class HistoricalLoanPolicyReader {
  constructor(private readonly prisma: PrismaService) {}

  /** Nunca consulta punteros de reglas vigentes ni infiere categoría del catálogo actual. */
  async read(
    tx: RulesTransaction,
    context: HistoricalLoanPolicyContext,
  ): Promise<HistoricalLoanPolicy> {
    const snapshot = object(context.snapshot);
    let reference = this.reference(snapshot);
    let policySource: HistoricalLoanPolicy['policySource'] = snapshot.loanPolicy !== undefined
      ? 'LOAN_SNAPSHOT' : 'LOAN_NO_SHOW_SNAPSHOT';
    if (!reference && context.reservationId) {
      const reservation = (
        await tx.query(
          this.prisma.sql.public.reservas
            .select('configurationSnapshot', 'createdAt')
            .where((r, f) => f.eq(r.id, context.reservationId!))
            .limit(1)
            .build(),
        )
      )[0];
      if (!reservation)
        throw new ConflictException('Reserva histórica no encontrada.');
      // La reserva vinculada también acredita la publicación cuando la copia
      // antigua del snapshot del préstamo no trasladó sus referencias.
      const reservedSnapshot = object(reservation.configurationSnapshot);
      reference = this.reference(reservedSnapshot);
      policySource = 'RESERVATION_SNAPSHOT';
      const loanCategory = text(object(snapshot.policy).categoryId);
      const reservedCategory = text(object(reservedSnapshot.policy).categoryId);
      if (loanCategory && reservedCategory && loanCategory !== reservedCategory)
        throw new ConflictException(
          'Las categorías históricas de reserva y préstamo no coinciden.',
        );
      if (reference && loanCategory && loanCategory !== reference.categoryId)
        throw new ConflictException(
          'La referencia de reserva no coincide con la categoría del préstamo.',
        );
      if (!reference) {
        const categoryId = loanCategory ?? reservedCategory;
        if (!categoryId)
          throw new ConflictException(
            'No hay categoría histórica acreditable.',
          );
        const publications = await tx.query(
          this.prisma.sql.public.versiones_terminos
            .select('id', 'numero', 'createdAt')
            .build(),
        );
        const confirmedAt = instantToDate(reservation.createdAt).getTime();
        const published = publications
          .filter((p) => instantToDate(p.createdAt).getTime() <= confirmedAt)
          .sort((a, b) => b.numero - a.numero || a.id.localeCompare(b.id))[0];
        if (!published)
          throw new ConflictException(
            'No existe publicación acreditada al confirmar la reserva.',
          );
        reference = { termsVersionId: published.id, categoryId };
        policySource = 'RESERVATION_CONFIRMATION';
      }
    }
    if (!reference)
      throw new ConflictException(
        'No existe referencia histórica de políticas del préstamo.',
      );
    const terms = await new PrismaTermsRepository(this.prisma)
      .forTransaction(tx)
      .readPublicVersion(reference.termsVersionId);
    try {
      return { ...historicalLoanPolicy(terms, reference), policySource };
    } catch (error) {
      if (error instanceof RangeError)
        throw new ConflictException(error.message);
      throw error;
    }
  }

  private reference(
    snapshot: Record<string, unknown>,
  ): LoanPolicyReference | null {
    const explicit = object(snapshot.loanPolicy);
    if (snapshot.loanPolicy !== undefined) {
      const termsVersionId = text(explicit.termsVersionId),
        categoryId = text(explicit.categoryId);
      if (!termsVersionId || !categoryId)
        throw new ConflictException('Referencia común histórica inválida.');
      const previous = text(object(snapshot.reservationNoShow).termsVersionId);
      if (previous && previous !== termsVersionId)
        throw new ConflictException(
          'Las referencias de publicación no coinciden.',
        );
      const snapshotCategory = text(object(snapshot.policy).categoryId);
      if (snapshotCategory && snapshotCategory !== categoryId)
        throw new ConflictException(
          'Las categorías del snapshot no coinciden.',
        );
      return { termsVersionId, categoryId };
    }
    const termsVersionId = text(
      object(snapshot.reservationNoShow).termsVersionId,
    );
    if (snapshot.reservationNoShow !== undefined && !termsVersionId)
      throw new ConflictException(
        'Referencia histórica de inasistencia inválida.',
      );
    if (termsVersionId) {
      const categoryId = text(object(snapshot.policy).categoryId);
      if (!categoryId)
        throw new ConflictException(
          'La publicación conservada no tiene categoría histórica acreditable.',
        );
      return { termsVersionId, categoryId };
    }
    return null;
  }
}
