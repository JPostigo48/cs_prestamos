import type { PublicPolicy, PublicTerms } from './entities/public-terms.js';

export interface CategoryPolicyConfiguration {
  status: 'COMPLETE' | 'INCOMPLETE' | 'UNAVAILABLE';
  eligibleForNewOperations: boolean;
  termsVersionId: string | null;
  policies: PublicPolicy[];
  rulesEditable: false;
  message: string;
}

/** Proyección de las versiones publicadas, nunca de otra categoría por nombre. */
export function categoryPolicyConfiguration(
  terms: PublicTerms | null,
  categoryId: string,
  activeVersionIds: ReadonlySet<string>,
): CategoryPolicyConfiguration {
  const policies = (terms?.policies ?? []).filter(
    (p) =>
      p.categoryId === categoryId ||
      (p.categoryId === null && p.category === null),
  );
  const current = policies.filter((p) => activeVersionIds.has(p.id));
  const has = (kind: PublicPolicy['kind'], severity: string | null = null) => {
    const matches = current.filter(
      (p) =>
        p.kind === kind &&
        p.severity === severity &&
        (['LATENESS', 'DAMAGE', 'REWARD', 'ACCESS'].includes(kind)
          ? p.categoryId === categoryId
          : p.categoryId === null),
    );
    if (matches.length !== 1) return false;
    const criteria = matches[0].criteria;
    return kind === 'LATENESS'
      ? Boolean(criteria.delayHours)
      : kind === 'NO_SHOW'
        ? Boolean(criteria.noShow)
        : kind === 'REWARD'
          ? Boolean(criteria.reward)
          : kind === 'ACCESS'
            ? Boolean(criteria.access?.allowedLevels.length)
            : kind === 'TRUST'
              ? Boolean(criteria.trust?.levels.length)
              : true;
  };
  const complete =
    terms?.policiesStatus === 'COMPLETE' &&
    ['LEVE', 'MODERADA', 'GRAVE'].every(
      (s) => has('LATENESS', s) && has('DAMAGE', s) && has('NO_SHOW', s),
    ) &&
    has('LOSS') &&
    has('REWARD') &&
    has('ACCESS') &&
    has('TRUST');
  return {
    status: complete ? 'COMPLETE' : terms ? 'INCOMPLETE' : 'UNAVAILABLE',
    eligibleForNewOperations: Boolean(complete),
    termsVersionId: terms?.id ?? null,
    policies,
    rulesEditable: false,
    message:
      'Consulta de políticas publicadas. Edición y publicación coordinada por categoría pendiente; no se guardan cambios de reglas desde esta operación.',
  };
}
