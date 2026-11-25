import type { PublicPolicy, PublicTerms } from './entities/public-terms.js';
import type { Severity } from './official-policy.catalog.js';
import { SuspensionType } from './entities/usage-rule.js';

export interface LoanPolicyReference {
  termsVersionId: string;
  categoryId: string;
}

/** Contrato de lectura para inspección/GET y ejecución: siempre publicación completa. */
export interface HistoricalLoanPolicy extends LoanPolicyReference {
  policySource?: 'LOAN_SNAPSHOT' | 'LOAN_NO_SHOW_SNAPSHOT' | 'RESERVATION_SNAPSHOT' | 'RESERVATION_CONFIRMATION';
  damageOptions: PublicPolicy[];
  lateness: PublicPolicy[];
  loss: PublicPolicy;
  reward: PublicPolicy;
}

export const severityRank = (severity: string | null): number =>
  ['LEVE', 'MODERADA', 'GRAVE'].indexOf(severity ?? '');

export function historicalLoanPolicy(
  terms: PublicTerms | null,
  reference: LoanPolicyReference,
): HistoricalLoanPolicy {
  if (
    !terms ||
    terms.id !== reference.termsVersionId ||
    terms.policiesStatus !== 'COMPLETE'
  )
    throw new RangeError('La publicación histórica no está completa.');
  const category = terms.policies.filter(
    (p) => p.categoryId === reference.categoryId,
  );
  const scale = (kind: 'LATENESS' | 'DAMAGE') => {
    const rows = category
      .filter((p) => p.kind === kind)
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
    if (
      rows.length !== 3 ||
      rows.some((p, i) => severityRank(p.severity) !== i)
    )
      throw new RangeError(`Escala histórica ${kind} incompleta o ambigua.`);
    for (const p of rows) validateChargePolicy(p);
    return rows;
  };
  const lateness = scale('LATENESS');
  const damageOptions = scale('DAMAGE');
  const categoryKeys = new Set(
    [...lateness, ...damageOptions].map((p) => p.category),
  );
  if (categoryKeys.size !== 1 || categoryKeys.has(null))
    throw new RangeError(
      'Las escalas no acreditan una única categoría histórica.',
    );
  for (let i = 1; i < damageOptions.length; i++) {
    const previous = damageOptions[i - 1]!,
      current = damageOptions[i]!;
    if (
      previous.trustEffect === 'SET_ZERO' ||
      (current.trustEffect !== 'SET_ZERO' &&
        (current.penaltyPoints! < previous.penaltyPoints! ||
          current.suspensionDays! < previous.suspensionDays!))
    )
      throw new RangeError('La escala histórica de daño no es creciente.');
  }
  let previousMax = 0,
    previousPoints = 0,
    previousDays = 0;
  for (const [i, p] of lateness.entries()) {
    const range = p.criteria.delayHours;
    if (
      !range ||
      range.exclusiveMin !== previousMax ||
      (i === 2
        ? range.inclusiveMax !== null
        : !Number.isFinite(range.inclusiveMax) ||
          range.inclusiveMax! <= range.exclusiveMin) ||
      p.trustEffect !== 'DISCOUNT' ||
      p.suspensionType !== SuspensionType.TEMPORARY ||
      p.penaltyPoints! < previousPoints ||
      p.suspensionDays! < previousDays
    )
      throw new RangeError(
        'Los tramos históricos de mora no son continuos y crecientes.',
      );
    previousMax = range.inclusiveMax!;
    previousPoints = p.penaltyPoints!;
    previousDays = p.suspensionDays!;
  }
  const one = (kind: 'LOSS' | 'REWARD') => {
    const rows = terms.policies.filter(
      (p) =>
        p.kind === kind &&
        (kind === 'LOSS'
          ? p.categoryId === null && p.category === null
          : p.categoryId === reference.categoryId),
    );
    if (rows.length !== 1)
      throw new RangeError(`Política histórica ${kind} ausente o ambigua.`);
    return rows[0]!;
  };
  const loss = one('LOSS');
  validateChargePolicy(loss);
  if (
    loss.trustEffect !== 'SET_ZERO' ||
    loss.suspensionType !== SuspensionType.INDEFINITE
  )
    throw new RangeError(
      'La pérdida requiere confianza cero y bloqueo indefinido.',
    );
  const reward = one('REWARD'),
    criteria = reward.criteria.reward;
  if (
    reward.trustEffect !== 'NONE' ||
    !criteria ||
    !Number.isFinite(criteria.referencePoints) ||
    criteria.referencePoints < 0 ||
    !Number.isFinite(criteria.fraction) ||
    criteria.fraction < 0 ||
    criteria.fraction > 1 ||
    criteria.maximumTrust !== 100
  )
    throw new RangeError('Recompensa histórica inválida.');
  return { ...reference, damageOptions, lateness, loss, reward };
}

function validateChargePolicy(p: PublicPolicy): void {
  if (p.trustEffect === 'SET_ZERO') {
    if (
      p.penaltyPoints !== null ||
      p.suspensionType !== SuspensionType.INDEFINITE ||
      p.suspensionDays !== null
    )
      throw new RangeError(
        'Establecer cero no es un cargo nominal de cien puntos.',
      );
  } else if (
    p.trustEffect !== 'DISCOUNT' ||
    !Number.isFinite(p.penaltyPoints) ||
    p.penaltyPoints! <= 0 ||
    p.penaltyPoints! > 100
  ) {
    throw new RangeError('Penalización histórica inválida.');
  }
  if (p.suspensionType === SuspensionType.TEMPORARY) {
    if (!Number.isSafeInteger(p.suspensionDays) || p.suspensionDays! <= 0)
      throw new RangeError('Duración histórica inválida.');
  } else if (
    p.suspensionType !== SuspensionType.INDEFINITE ||
    p.suspensionDays !== null
  ) {
    throw new RangeError('Suspensión histórica inválida.');
  }
}

/** Reconstruye todos los umbrales cruzados, inclusive con ejecución demorada. */
export function crossedLateness(
  policy: HistoricalLoanPolicy,
  dueAt: Date,
  effectiveAt: Date,
): { policy: PublicPolicy; effectiveAt: Date }[] {
  const elapsed = effectiveAt.getTime() - dueAt.getTime();
  if (!Number.isFinite(elapsed)) throw new RangeError('Instante inválido.');
  return policy.lateness
    .filter((p) => elapsed > p.criteria.delayHours!.exclusiveMin * 3_600_000)
    .map((p) => ({
      policy: p,
      effectiveAt: new Date(
        dueAt.getTime() + p.criteria.delayHours!.exclusiveMin * 3_600_000 + 1,
      ),
    }));
}

export function aggregateDamage(
  policy: HistoricalLoanPolicy,
  damage: Severity | null,
  missing: Severity | null,
): PublicPolicy | null {
  const rank = Math.max(severityRank(damage), severityRank(missing));
  if (
    (damage !== null && severityRank(damage) < 0) ||
    (missing !== null && severityRank(missing) < 0)
  )
    throw new RangeError('Gravedad no reconocida.');
  return rank < 0 ? null : policy.damageOptions[rank]!;
}
