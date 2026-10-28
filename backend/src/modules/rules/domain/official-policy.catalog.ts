import { SuspensionType } from './entities/usage-rule.js';

// Línea base vigente para desarrollo; no implica aprobación institucional externa.
export const OFFICIAL_POLICY_RELEASE = '2026-10-19';
export const OFFICIAL_TERMS_NUMBER = 1;
export const OFFICIAL_TERMS_TITLE =
  'Términos y condiciones — línea base 2026-10-19';
export type CategoryKey = 'ELECTRONICOS' | 'LIBROS' | 'DEPORTES';
export type Severity = 'LEVE' | 'MODERADA' | 'GRAVE';
export type TrustEffect = 'DISCOUNT' | 'SET_ZERO' | 'NONE';
type PolicyKind =
  'LATENESS' | 'DAMAGE' | 'LOSS' | 'NO_SHOW' | 'REWARD' | 'ACCESS' | 'TRUST';

export const OFFICIAL_CATEGORIES = [
  { key: 'ELECTRONICOS', name: 'Electrónicos', days: 0, hours: 8 },
  { key: 'LIBROS', name: 'Libros', days: 14, hours: null },
  { key: 'DEPORTES', name: 'Deportes', days: 2, hours: null },
] as const;

export interface PolicyCriteria {
  condition: string;
  delayHours?: { exclusiveMin: number; inclusiveMax: number | null };
  noShow?: {
    inclusiveMin: number;
    inclusiveMax: number | null;
    rollingDays: number;
    pickupMinutes: number;
  };
  reward?: { referencePoints: number; fraction: number; maximumTrust: number };
  access?: {
    allowedLevels: readonly string[];
    durationHours: number;
    campusOnly: boolean;
  };
  trust?: {
    initial: number;
    minimum: number;
    maximum: number;
    decimals: number;
    levels: readonly {
      name: string;
      inclusiveMin: number;
      exclusiveMax: number | null;
    }[];
  };
}

export interface OfficialPolicy {
  key: string;
  ruleId: string;
  versionId: string;
  version: number;
  kind: PolicyKind;
  category: CategoryKey | null;
  severity: Severity | null;
  title: string;
  criteria: PolicyCriteria;
  trustEffect: TrustEffect;
  penalty: number;
  suspensionType: SuspensionType;
  suspensionDays: number | null;
  consequence: string;
  source: string;
}

// Slots permanentes: no reutilizar para otra regla ni cambiar el significado de v1.
function identity(slot: number) {
  const tail = String(slot).padStart(12, '0');
  return {
    ruleId: `7a261019-0001-4000-8000-${tail}`,
    versionId: `7a261019-0002-4000-8000-${tail}`,
    version: 1,
  };
}
const severities: readonly Severity[] = ['LEVE', 'MODERADA', 'GRAVE'];
const source = (section: string) =>
  `docs/requirements/terms-and-conditions.md#${section}`;

function sanction(
  slot: number,
  kind: PolicyKind,
  key: string,
  category: CategoryKey | null,
  severity: Severity | null,
  criteria: PolicyCriteria,
  penalty: number,
  days: number | null,
  trustEffect: TrustEffect = 'DISCOUNT',
): OfficialPolicy {
  const suspensionType =
    days === null
      ? SuspensionType.INDEFINITE
      : days === 0
        ? SuspensionType.NONE
        : SuspensionType.TEMPORARY;
  return {
    ...identity(slot),
    key,
    kind,
    category,
    severity,
    title: key,
    criteria,
    trustEffect,
    penalty,
    suspensionType,
    suspensionDays: days === 0 ? null : days,
    consequence: `${trustEffect === 'SET_ZERO' ? 'Establecer confianza en 0' : `Descontar ${penalty} puntos`}; ${days === null ? 'bloqueo indefinido hasta resolución interna o absolución' : days === 0 ? 'sin suspensión' : `${days} días de suspensión total`}.`,
    source: source(
      kind === 'LATENESS'
        ? '5-regla-r-tar-devolución-tardía'
        : kind === 'DAMAGE'
          ? '6-regla-r-dan-daño-o-piezas-faltantes'
          : kind === 'LOSS'
            ? '7-regla-r-per-pérdida-o-robo'
            : 'regla-r-res-inasistencia-a-una-reserva',
    ),
  };
}

const policies: OfficialPolicy[] = [];
const lateness = [
  { limits: [1, 3], penalties: [10, 20, 30], days: [7, 15, 30] },
  { limits: [24, 72], penalties: [10, 15, 20], days: [7, 14, 30] },
  { limits: [3, 12], penalties: [10, 15, 20], days: [7, 14, 30] },
] as const;
const damage = [
  {
    penalties: [10, 30, 0],
    days: [7, 30, null],
    conditions: [
      'Daño estético atribuible a uso indebido sin afectar funcionamiento.',
      'Daño funcional reparable, accesorio esencial dañado o pieza faltante recuperable.',
      'Equipo inutilizable o daño crítico.',
    ],
  },
  {
    penalties: [10, 20, 30],
    days: [7, 15, 30],
    conditions: [
      'Línea pintada, pequeño subrayado o marca aislada por mal uso.',
      'Varias páginas intervenidas o daño reparable relevante.',
      'Hojas rotas o arrancadas, mojado severo o libro inutilizable.',
    ],
  },
  {
    penalties: [10, 20, 30],
    days: [7, 15, 30],
    conditions: [
      'Deterioro superficial por uso indebido que no afecta el uso.',
      'Daño funcional reparable o accesorio incompleto.',
      'Rotura importante o pérdida de utilidad.',
    ],
  },
] as const;

for (const [c, category] of OFFICIAL_CATEGORIES.entries()) {
  for (const [s, severity] of severities.entries()) {
    const late = lateness[c];
    policies.push(
      sanction(
        1 + c * 3 + s,
        'LATENESS',
        `R-TAR:${category.key}:${severity}`,
        category.key,
        severity,
        {
          condition:
            'Sin tolerancia; consecuencia total de la misma tardanza. Escalar solo la diferencia, sin duplicar cargos al devolver.',
          delayHours: {
            exclusiveMin: s === 0 ? 0 : late.limits[s - 1],
            inclusiveMax: s === 2 ? null : late.limits[s],
          },
        },
        late.penalties[s],
        late.days[s],
      ),
    );
    const damaged = damage[c];
    policies.push(
      sanction(
        11 + c * 3 + s,
        'DAMAGE',
        `R-DAN:${category.key}:${severity}`,
        category.key,
        severity,
        {
          condition: `${damaged.conditions[s]} Excluir desgaste normal. Mayor gravedad acreditada del mismo incidente; no duplicar descripciones equivalentes.`,
        },
        damaged.penalties[s],
        damaged.days[s],
        c === 0 && s === 2 ? 'SET_ZERO' : 'DISCOUNT',
      ),
    );
  }
}
policies.push(
  sanction(
    21,
    'LOSS',
    'R-PER',
    null,
    null,
    {
      condition:
        'Pérdida o robo confirmado en cualquier categoría. Cerrar por incidencia sin devolución ficticia ni recompensa; conservar tardanza y detener escalamiento. No duplicar daño por el mismo hecho. Sin importe económico automático.',
    },
    0,
    null,
    'SET_ZERO',
  ),
);
for (const [s, severity] of severities.entries()) {
  policies.push(
    sanction(
      22 + s,
      'NO_SHOW',
      `R-RES:${severity}`,
      null,
      severity,
      {
        condition:
          'Contar la actual y anteriores no absueltas del mismo usuario en (ahora − 30 días, ahora]. Una sola falta por reserva; cancelación válida o administrativa no sanciona.',
        noShow: {
          inclusiveMin: s + 1,
          inclusiveMax: s === 2 ? null : s + 1,
          rollingDays: 30,
          pickupMinutes: 30,
        },
      },
      [2, 3, 5][s],
      0,
    ),
  );
}
function configuration(
  slot: number,
  kind: PolicyKind,
  key: string,
  category: CategoryKey | null,
  criteria: PolicyCriteria,
  section: string,
): OfficialPolicy {
  return {
    ...identity(slot),
    key,
    kind,
    category,
    severity: null,
    title: key,
    criteria,
    trustEffect: 'NONE',
    penalty: 0,
    suspensionType: SuspensionType.NONE,
    suspensionDays: null,
    consequence:
      'Configuración versionada; no constituye una falta ni autoriza un descuento.',
    source: source(section),
  };
}
for (const [c, category] of OFFICIAL_CATEGORIES.entries()) {
  policies.push(
    configuration(
      31 + c,
      'REWARD',
      `R-PUN:${category.key}`,
      category.key,
      {
        condition:
          'Una sola recompensa al devolver antes o justo al límite, completo, sin daño indebido ni otra falta. Conservar referencia al reservar.',
        reward: {
          referencePoints: c === 0 ? 30 : 10,
          fraction: 0.1,
          maximumTrust: 100,
        },
      },
      '9-recompensa-por-devolución-puntual-y-sin-faltas',
    ),
  );
  policies.push(
    configuration(
      41 + c,
      'ACCESS',
      `R-ACC:${category.key}`,
      category.key,
      {
        condition:
          'Además: aprobación, vinculación vigente, términos aceptados, disponibilidad y ausencia de restricciones. Un estudiante: una operación abierta total; docentes/administrativos sin límite numérico general.',
        access: {
          allowedLevels:
            c === 0
              ? ['EXCELENTE', 'CONFIABLE']
              : ['EXCELENTE', 'CONFIABLE', 'EN_OBSERVACION'],
          durationHours: category.hours ?? category.days * 24,
          campusOnly: c === 0,
        },
      },
      '3-categorías-duración-y-acceso',
    ),
  );
}
policies.push(
  configuration(
    50,
    'TRUST',
    'R-CON',
    null,
    {
      condition:
        'Dos decimales, redondeo aritmético y límites cerrados [0,100]. Conservar importe nominal/efectivo y saldos. No alterar sanciones históricas.',
      trust: {
        initial: 75,
        minimum: 0,
        maximum: 100,
        decimals: 2,
        levels: [
          { name: 'CRITICO', inclusiveMin: 0, exclusiveMax: 25 },
          { name: 'EN_OBSERVACION', inclusiveMin: 25, exclusiveMax: 50 },
          { name: 'CONFIABLE', inclusiveMin: 50, exclusiveMax: 75 },
          { name: 'EXCELENTE', inclusiveMin: 75, exclusiveMax: null },
        ],
      },
    },
    'confianza-y-límites-simultáneos',
  ),
);

export const OFFICIAL_POLICIES: readonly OfficialPolicy[] = policies;
export const POLICY_DESCRIPTION_FORMAT = 'epcc.official-policy/v1';

export function describeOfficialPolicy(
  policy: OfficialPolicy,
  categoryId: string | null,
): string {
  return JSON.stringify({
    format: POLICY_DESCRIPTION_FORMAT,
    release: OFFICIAL_POLICY_RELEASE,
    key: policy.key,
    kind: policy.kind,
    category: policy.category,
    categoryId,
    severity: policy.severity,
    trustEffect: policy.trustEffect,
    criteria: policy.criteria,
    source: policy.source,
  });
}

// Solo se interpreta el contrato mínimo usado por el registro existente, no otro motor.
export function readOfficialPolicyEffect(
  description: string | undefined,
): { kind: PolicyKind; trustEffect: TrustEffect } | null {
  if (!description) return null;
  let data: unknown;
  try {
    data = JSON.parse(description);
  } catch {
    return null;
  }
  if (
    !data ||
    typeof data !== 'object' ||
    !('format' in data) ||
    data.format !== POLICY_DESCRIPTION_FORMAT
  )
    return null;
  if (!('kind' in data) || !('trustEffect' in data))
    throw new Error('Metadatos de política incompletos.');
  const kinds: readonly unknown[] = [
    'LATENESS',
    'DAMAGE',
    'LOSS',
    'NO_SHOW',
    'REWARD',
    'ACCESS',
    'TRUST',
  ];
  const effects: readonly unknown[] = ['DISCOUNT', 'SET_ZERO', 'NONE'];
  if (!kinds.includes(data.kind) || !effects.includes(data.trustEffect))
    throw new Error('Metadatos de política inválidos.');
  if (
    data.trustEffect === 'SET_ZERO' &&
    data.kind !== 'LOSS' &&
    data.kind !== 'DAMAGE'
  )
    throw new Error('Efecto de confianza incompatible.');
  return {
    kind: data.kind as PolicyKind,
    trustEffect: data.trustEffect as TrustEffect,
  };
}
