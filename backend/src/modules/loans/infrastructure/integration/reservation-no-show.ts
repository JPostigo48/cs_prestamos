import { ServiceUnavailableException } from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import type { CopyLoanSnapshot } from '../../../inventory/domain/entities/resource-configuration.js';
import { reservationNoShowPolicy } from '../../../rules/domain/reservation-no-show-policy.js';
import { PrismaTermsRepository } from '../../../rules/infrastructure/persistence/prisma/prisma-terms.repository.js';
import { PrismaViolationRepository } from '../../../rules/infrastructure/persistence/prisma/prisma-violation.repository.js';
import { SuspensionType } from '../../../rules/domain/entities/usage-rule.js';

type Runtime = Pick<ReturnType<PrismaService['client']['runtime']>, 'query'>;

/** Solo se invoca tras bloquear usuario y reclamar una CONFIRMADA vencida en la tx. */
export async function registerReservationNoShow(
  prisma: PrismaService,
  tx: Runtime,
  reservation: {
    id: string;
    usuarioId: string;
    createdAt: unknown;
    configurationSnapshot: unknown;
  },
  at: Date,
) {
  const existing = await tx.query(
    prisma.sql.public.incumplimientos
      .select('id', 'usuarioId')
      .where((r, f) => f.eq(r.reservaId, reservation.id))
      .build(),
  );
  if (existing[0]) {
    const sanctions = await tx.query(
      prisma.sql.public.sanciones
        .select('id')
        .where((r, f) => f.eq(r.incumplimientoId, existing[0]!.id))
        .build(),
    );
    if (existing[0].usuarioId !== reservation.usuarioId || !sanctions[0])
      throw new ServiceUnavailableException(
        'El antecedente de la reserva requiere revisión.',
      );
    // Incluye sanciones absueltas: nunca regenerarlas ni volver a descontar.
    return;
  }
  const snapshot = reservation.configurationSnapshot as CopyLoanSnapshot | null;
  let termsId = snapshot?.reservationNoShow?.termsVersionId;
  if (!termsId) {
    if (!reservation.createdAt)
      throw new ServiceUnavailableException(
        'No se pudo determinar la fecha de creación de la reserva.',
      );
    // Compatibilidad histórica cerrada: publicación a la fecha de creación,
    // nunca términos/reglas actuales ni recálculo del plazo persistido.
    const terms = await tx.query(
      prisma.sql.public.versiones_terminos
        .select('id', 'numero')
        .where((r, f) =>
          f.lte(r.createdAt, reservation.createdAt as Temporal.Instant),
        )
        .orderBy((r) => r.numero, { direction: 'desc' })
        .limit(1)
        .build(),
    );
    termsId = terms[0]?.id;
  }
  if (!termsId)
    throw new ServiceUnavailableException(
      'No se pudo determinar la publicación de la reserva.',
    );
  const terms = await new PrismaTermsRepository(prisma)
    .forTransaction(tx)
    .readPublicVersion(termsId);
  if (!terms || terms.policiesStatus !== 'COMPLETE')
    throw new ServiceUnavailableException(
      'La política histórica de la reserva no está disponible.',
    );
  let policy;
  try {
    policy = reservationNoShowPolicy(terms.policies);
  } catch {
    throw new ServiceUnavailableException(
      'La política LEVE de inasistencia no está disponible.',
    );
  }
  if (
    snapshot?.reservationNoShow &&
    policy.id !== snapshot.reservationNoShow.ruleVersionId
  )
    throw new ServiceUnavailableException(
      'La versión de inasistencia no coincide con la reserva.',
    );
  await new PrismaViolationRepository(prisma).createReservationPenalty(
    tx,
    {
      userId: reservation.usuarioId,
      reservationId: reservation.id,
      ruleId: policy.ruleId,
      ruleVersionId: policy.id,
      occurredAt: at,
      configuredPenalty: policy.penaltyPoints!,
      trustEffect: 'DISCOUNT',
      suspensionType: SuspensionType.NONE,
      suspensionDays: policy.suspensionDays,
    },
    at,
  );
}
