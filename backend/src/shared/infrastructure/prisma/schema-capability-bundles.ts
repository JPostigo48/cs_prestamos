/** Physical requirements of 20261125T0313_loan_policy_episodes, not its ledger. */
export interface ColumnRequirement {
  readonly type: string;
  readonly nullable: boolean;
}

const column = (type: string, nullable = false): ColumnRequirement => ({
  type,
  nullable,
});
const json = () => column('jsonb');
const uuid = (nullable = false) => column('uuid', nullable);
const timestamp = () => column('timestamp(3) with time zone');
const numeric = (nullable = false) => column('numeric(5,2)', nullable);

export const SCHEMA_COLUMNS = {
  ejemplares: {
    condicionFisica: column('text', true),
    habilitado: column('boolean'),
  },
  incumplimientos: {
    categoriaId: uuid(true),
    origen: column('text', true),
    prestamoId: uuid(true),
    termsVersionId: uuid(true),
  },
  ajustes_incumplimiento: {
    actor: json(),
    calendarioAnterior: json(),
    calendarioPosterior: json(),
    contexto: json(),
    createdAt: timestamp(),
    descuentoEfectivo: numeric(),
    duracionTotalDias: column('integer', true),
    efecto: column('character varying(20)'),
    fechaEfectiva: timestamp(),
    id: uuid(),
    incrementoDias: column('integer', true),
    incrementoNominal: numeric(true),
    incumplimientoId: uuid(),
    nominalObjetivo: numeric(true),
    saldoAnterior: numeric(),
    saldoPosterior: numeric(),
    severidad: column('character varying(40)'),
    versionReglaId: uuid(),
  },
  cierres_prestamo: {
    actor: json(),
    contexto: json(),
    createdAt: timestamp(),
    fechaEfectiva: timestamp(),
    id: uuid(),
    inspeccion: column('jsonb', true),
    prestamoId: uuid(),
    recompensa: column('jsonb', true),
    requestHash: column('character varying(64)'),
    requestId: column('character varying(120)'),
    resultado: json(),
  },
  prestamos: { estado: column('text') },
} as const;

export const SCHEMA_ENUMS = [
  {
    table: 'ejemplares',
    column: 'condicionFisica',
    values: [
      'APTO',
      'DANADO',
      'INCOMPLETO',
      'DANADO_E_INCOMPLETO',
      'PERDIDO',
      'ROBADO',
    ],
  },
  {
    table: 'incumplimientos',
    column: 'origen',
    values: ['MORA', 'DANO', 'PERDIDA'],
  },
  {
    table: 'prestamos',
    column: 'estado',
    values: ['PLANIFICADO', 'ACTIVO', 'FINALIZADO', 'CERRADO_POR_INCIDENCIA'],
  },
] as const;

export const SCHEMA_CHECKS = [
  {
    table: 'ajustes_incumplimiento', key: 'adjustmentEffect',
    expression: `(efecto = 'SET_ZERO' AND "nominalObjetivo" IS NULL AND "incrementoNominal" IS NULL AND "duracionTotalDias" IS NULL AND "incrementoDias" IS NULL AND "saldoPosterior" = 0) OR (efecto = 'DISCOUNT' AND "nominalObjetivo" BETWEEN 0 AND 100 AND "incrementoNominal" BETWEEN 0 AND "nominalObjetivo" AND "duracionTotalDias" > 0 AND "incrementoDias" BETWEEN 0 AND "duracionTotalDias")`,
  },
  {
    table: 'ajustes_incumplimiento', key: 'adjustmentBalances',
    expression: `"descuentoEfectivo" >= 0 AND "saldoAnterior" BETWEEN 0 AND 100 AND "saldoPosterior" BETWEEN 0 AND 100 AND "saldoAnterior" - "saldoPosterior" = "descuentoEfectivo"`,
  },
  {
    table: 'incumplimientos', key: 'episodeContext',
    expression: `("prestamoId" IS NULL AND origen IS NULL) OR ("prestamoId" IS NOT NULL AND "categoriaId" IS NOT NULL AND "termsVersionId" IS NOT NULL AND origen IS NOT NULL)`,
  },
] as const;

export const SCHEMA_UNIQUES = [
  {
    table: 'ajustes_incumplimiento',
    name: 'ajustes_incumplimiento_pkey',
    columns: ['id'],
    kind: 'p',
  },
  {
    table: 'cierres_prestamo',
    name: 'cierres_prestamo_pkey',
    columns: ['id'],
    kind: 'p',
  },
  {
    table: 'ajustes_incumplimiento',
    name: 'ajustes_incumplimiento_incumplimientoId_severidad_versionReglaId_key',
    columns: ['incumplimientoId', 'severidad', 'versionReglaId'],
    kind: 'u',
  },
  {
    table: 'cierres_prestamo',
    name: 'cierres_prestamo_prestamoId_key',
    columns: ['prestamoId'],
    kind: 'u',
  },
  {
    table: 'cierres_prestamo',
    name: 'cierres_prestamo_requestId_key',
    columns: ['requestId'],
    kind: 'u',
  },
  {
    table: 'incumplimientos',
    name: 'incumplimientos_prestamoId_origen_key',
    columns: ['prestamoId', 'origen'],
    kind: 'u',
  },
] as const;

export const SCHEMA_FOREIGN_KEYS = [
  {
    table: 'ajustes_incumplimiento',
    column: 'incumplimientoId',
    target: 'incumplimientos',
  },
  {
    table: 'ajustes_incumplimiento',
    column: 'versionReglaId',
    target: 'versiones_regla',
  },
  { table: 'cierres_prestamo', column: 'prestamoId', target: 'prestamos' },
  {
    table: 'incumplimientos',
    column: 'categoriaId',
    target: 'categorias_recurso',
  },
  { table: 'incumplimientos', column: 'prestamoId', target: 'prestamos' },
  {
    table: 'incumplimientos',
    column: 'termsVersionId',
    target: 'versiones_terminos',
  },
] as const;

const tableCapabilities = (table: keyof typeof SCHEMA_COLUMNS) => [
  `table:${table}`,
  ...Object.keys(SCHEMA_COLUMNS[table]).map(
    (name) => `column:${table}.${name}`,
  ),
  ...SCHEMA_ENUMS.filter((e) => e.table === table).map(
    (e) => `enum:${e.table}.${e.column}`,
  ),
  ...SCHEMA_UNIQUES.filter((u) => u.table === table).map(
    (u) => `unique:${u.name}`,
  ),
  ...SCHEMA_FOREIGN_KEYS.filter((f) => f.table === table).map(
    (f) => `foreignKey:${f.table}_${f.column}_fkey`,
  ),
  ...SCHEMA_CHECKS.filter((c) => c.table === table).map(c => `check:${c.key}`),
];

const copyPhysicalState = tableCapabilities('ejemplares');
const loanClosure = [
  ...tableCapabilities('cierres_prestamo'),
  ...tableCapabilities('prestamos'),
];
const loanEpisodes = [
  ...tableCapabilities('incumplimientos'),
  ...tableCapabilities('ajustes_incumplimiento'),
];

export const SCHEMA_CAPABILITY_BUNDLES = Object.freeze({
  copyPhysicalState: Object.freeze(copyPhysicalState),
  loanClosure: Object.freeze(loanClosure),
  loanEpisodes: Object.freeze(loanEpisodes),
  loanPolicyEpisodes: Object.freeze([
    ...copyPhysicalState,
    ...loanClosure,
    ...loanEpisodes,
  ]),
});
export type SchemaCapabilityBundle = keyof typeof SCHEMA_CAPABILITY_BUNDLES;
