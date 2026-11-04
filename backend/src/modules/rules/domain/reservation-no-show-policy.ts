import type { PublicPolicy } from './entities/public-terms.js';
import { SuspensionType } from './entities/usage-rule.js';

/** La inasistencia de este flujo siempre usa LEVE, no el contador histórico. */
export function reservationNoShowPolicy(
  policies: readonly PublicPolicy[],
): PublicPolicy {
  const matches = policies.filter(
    (p) =>
      p.kind === 'NO_SHOW' &&
      p.key === 'R-RES:LEVE' &&
      p.severity === 'LEVE' &&
      p.category === null &&
      p.categoryId === null,
  );
  const policy = matches[0];
  if (
    matches.length !== 1 ||
    !policy ||
    !policy.criteria.noShow ||
    policy.trustEffect !== 'DISCOUNT' ||
    !Number.isFinite(policy.penaltyPoints) ||
    policy.penaltyPoints! <= 0 ||
    policy.penaltyPoints! > 100 ||
    policy.suspensionType !== SuspensionType.NONE ||
    (policy.suspensionDays !== null && policy.suspensionDays !== 0)
  ) {
    throw new RangeError(
      'No existe una política publicada LEVE de inasistencia válida.',
    );
  }
  return policy;
}
