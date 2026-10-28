import {
  OFFICIAL_POLICIES,
  OFFICIAL_POLICY_RELEASE,
  OFFICIAL_TERMS_NUMBER,
  OFFICIAL_TERMS_TITLE,
  POLICY_DESCRIPTION_FORMAT,
  type PolicyCriteria,
} from './official-policy.catalog.js';
import type { PublicPolicy } from './entities/public-terms.js';
import type { TermsVersion } from './entities/terms.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): v is ObjectValue =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const numeric = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const nullableNumber = (v: unknown): v is number | null =>
  v === null || numeric(v);

/** Manifiesto inmutable dentro del contenido existente: no requiere nuevas tablas. */
export function termsPolicyManifest(
  terms: TermsVersion,
): { ids: string[]; legacy: boolean } | null {
  const match = terms.content?.match(
    /<!--\s*epcc\.policy-versions\/v1:\s*([\s\S]*?)\s*-->/,
  );
  if (match) {
    try {
      const ids: unknown = JSON.parse(match[1]!);
      if (
        Array.isArray(ids) &&
        ids.length > 0 &&
        ids.every((id) => typeof id === 'string' && uuid.test(id)) &&
        new Set(ids).size === ids.length
      )
        return { ids, legacy: false };
    } catch {
      /* No inferir vínculos a partir de reglas activas. */
    }
    return null;
  }
  // Compatibilidad cerrada con la semilla inicial ya preparada, sin alterar su contenido.
  if (
    terms.number === OFFICIAL_TERMS_NUMBER &&
    terms.title === OFFICIAL_TERMS_TITLE
  )
    return { ids: OFFICIAL_POLICIES.map((p) => p.versionId), legacy: true };
  return null;
}

/** Proyección explícita: nunca publicar objetos JSON arbitrarios de la descripción. */
function publicCriteria(value: unknown): PolicyCriteria | null {
  if (!object(value) || typeof value.condition !== 'string') return null;
  const result: PolicyCriteria = { condition: value.condition };
  const delay = value.delayHours;
  if (delay !== undefined) {
    if (
      !object(delay) ||
      !numeric(delay.exclusiveMin) ||
      !nullableNumber(delay.inclusiveMax)
    )
      return null;
    result.delayHours = {
      exclusiveMin: delay.exclusiveMin,
      inclusiveMax: delay.inclusiveMax,
    };
  }
  const noShow = value.noShow;
  if (noShow !== undefined) {
    if (
      !object(noShow) ||
      !numeric(noShow.inclusiveMin) ||
      !nullableNumber(noShow.inclusiveMax) ||
      !numeric(noShow.rollingDays) ||
      !numeric(noShow.pickupMinutes)
    )
      return null;
    result.noShow = {
      inclusiveMin: noShow.inclusiveMin,
      inclusiveMax: noShow.inclusiveMax,
      rollingDays: noShow.rollingDays,
      pickupMinutes: noShow.pickupMinutes,
    };
  }
  const reward = value.reward;
  if (reward !== undefined) {
    if (
      !object(reward) ||
      !numeric(reward.referencePoints) ||
      !numeric(reward.fraction) ||
      !numeric(reward.maximumTrust)
    )
      return null;
    result.reward = {
      referencePoints: reward.referencePoints,
      fraction: reward.fraction,
      maximumTrust: reward.maximumTrust,
    };
  }
  const access = value.access;
  if (access !== undefined) {
    if (
      !object(access) ||
      !Array.isArray(access.allowedLevels) ||
      !access.allowedLevels.every((x) => typeof x === 'string') ||
      !numeric(access.durationHours) ||
      typeof access.campusOnly !== 'boolean'
    )
      return null;
    result.access = {
      allowedLevels: access.allowedLevels,
      durationHours: access.durationHours,
      campusOnly: access.campusOnly,
    };
  }
  const trust = value.trust;
  if (trust !== undefined) {
    if (
      !object(trust) ||
      !numeric(trust.initial) ||
      !numeric(trust.minimum) ||
      !numeric(trust.maximum) ||
      !numeric(trust.decimals) ||
      !Array.isArray(trust.levels)
    )
      return null;
    const levels: NonNullable<PolicyCriteria['trust']>['levels'][number][] = [];
    for (const level of trust.levels) {
      if (
        !object(level) ||
        typeof level.name !== 'string' ||
        !numeric(level.inclusiveMin) ||
        !nullableNumber(level.exclusiveMax)
      )
        return null;
      levels.push({
        name: level.name,
        inclusiveMin: level.inclusiveMin,
        exclusiveMax: level.exclusiveMax,
      });
    }
    result.trust = {
      initial: trust.initial,
      minimum: trust.minimum,
      maximum: trust.maximum,
      decimals: trust.decimals,
      levels,
    };
  }
  return result;
}

export interface PublicPolicyRow {
  id: string;
  reglaId: string;
  numero: number;
  titulo: string;
  descripcion: string;
  penalizacionPorcentual: unknown;
  consecuencia: string;
  tipoSuspension: string | null;
  diasSuspension: number | null;
}

export function projectPublicPolicy(
  row: PublicPolicyRow,
  legacy: boolean,
): PublicPolicy | null {
  let metadata: unknown;
  try {
    metadata = JSON.parse(row.descripcion);
  } catch {
    return null;
  }
  if (
    !object(metadata) ||
    metadata.format !== POLICY_DESCRIPTION_FORMAT ||
    (legacy && metadata.release !== OFFICIAL_POLICY_RELEASE)
  )
    return null;
  if (
    typeof metadata.key !== 'string' ||
    ![
      'LATENESS',
      'DAMAGE',
      'LOSS',
      'NO_SHOW',
      'REWARD',
      'ACCESS',
      'TRUST',
    ].includes(String(metadata.kind)) ||
    !['DISCOUNT', 'SET_ZERO', 'NONE'].includes(String(metadata.trustEffect))
  )
    return null;
  if (
    !(metadata.category === null || typeof metadata.category === 'string') ||
    !(
      metadata.categoryId === null || typeof metadata.categoryId === 'string'
    ) ||
    !(metadata.severity === null || typeof metadata.severity === 'string')
  )
    return null;
  const criteria = publicCriteria(metadata.criteria);
  const penalty = Number(row.penalizacionPorcentual);
  if (!criteria || !Number.isFinite(penalty)) return null;
  return {
    id: row.id,
    ruleId: row.reglaId,
    number: row.numero,
    title: row.titulo,
    key: metadata.key,
    kind: metadata.kind as PublicPolicy['kind'],
    category: metadata.category,
    categoryId: metadata.categoryId,
    severity: metadata.severity,
    trustEffect: metadata.trustEffect as PublicPolicy['trustEffect'],
    penaltyPoints: metadata.trustEffect === 'DISCOUNT' ? penalty : null,
    suspensionType: row.tipoSuspension,
    suspensionDays: row.diasSuspension,
    consequence: row.consecuencia,
    criteria,
  };
}
