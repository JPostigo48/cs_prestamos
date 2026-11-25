import type { PublicPolicy } from './entities/public-terms.js';

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** El nominal alcanzado no es la suma de descuentos efectivos. */
export function episodeAdjustment(
  policy: PublicPolicy,
  balance: number,
  nominalReached: number,
  daysReached: number,
) {
  if (
    ![balance, nominalReached, daysReached].every(Number.isFinite) ||
    balance < 0 ||
    balance > 100 ||
    nominalReached < 0 ||
    daysReached < 0
  )
    throw new RangeError('Saldos del episodio inválidos.');
  const zero = policy.trustEffect === 'SET_ZERO';
  const target = zero ? null : policy.penaltyPoints;
  if (!zero && (target === null || target < nominalReached))
    throw new RangeError('El ajuste no puede reducir la consecuencia nominal.');
  const increment = zero ? null : round(target! - nominalReached);
  const effective = zero ? balance : round(Math.min(increment!, balance));
  const totalDays = policy.suspensionDays;
  if (totalDays !== null && totalDays < daysReached)
    throw new RangeError('El ajuste no puede reducir la duración alcanzada.');
  return {
    nominalTarget: target,
    nominalIncrement: increment,
    effectiveDiscount: effective,
    previousBalance: balance,
    resultingBalance: round(balance - effective),
    totalDays,
    additionalDays: totalDays === null ? null : totalDays - daysReached,
  };
}

/** Legado sin ajustes: conserva la diferencia original, nunca el nominal. */
export function appealRestitution(
  balance: number,
  effectiveAdjustments: readonly number[],
  legacyBefore: number,
  legacyAfter: number,
) {
  const deducted = effectiveAdjustments.length
    ? effectiveAdjustments.reduce((sum, n) => round(sum + n), 0)
    : Math.max(0, round(legacyBefore - legacyAfter));
  if (
    ![balance, deducted].every(Number.isFinite) ||
    balance < 0 ||
    balance > 100 ||
    deducted < 0
  )
    throw new RangeError('Restitución inválida.');
  return {
    deducted,
    resultingBalance: round(Math.min(100, balance + deducted)),
  };
}
