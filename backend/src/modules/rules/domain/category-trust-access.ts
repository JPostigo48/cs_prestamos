import type { PublicPolicy } from './entities/public-terms.js';

/** Autorización con la escala y categorías PUBLICADAS, sin matriz paralela. */
export function categoryTrustAccess(
  policies: readonly PublicPolicy[],
  categoryId: string,
  balance: number,
): boolean {
  const scales = policies.filter(
    (p) => p.kind === 'TRUST' && p.categoryId === null,
  );
  const accesses = policies.filter(
    (p) => p.kind === 'ACCESS' && p.categoryId === categoryId,
  );
  const scale = scales.length === 1 ? scales[0].criteria.trust : null;
  const access = accesses.length === 1 ? accesses[0].criteria.access : null;
  if (
    !scale ||
    !access ||
    !Number.isFinite(balance) ||
    balance < scale.minimum ||
    balance > scale.maximum
  )
    throw new RangeError('No hay una política de confianza/categoría válida.');
  const levels = scale.levels.filter(
    (level) =>
      balance >= level.inclusiveMin &&
      (level.exclusiveMax === null || balance < level.exclusiveMax),
  );
  if (levels.length !== 1)
    throw new RangeError('La escala publicada es ambigua.');
  return access.allowedLevels.includes(levels[0].name);
}
