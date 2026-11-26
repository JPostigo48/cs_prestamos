import { ServiceUnavailableException } from '@nestjs/common';
import {
  SCHEMA_CAPABILITY_BUNDLES,
  SCHEMA_CHECKS,
  SCHEMA_COLUMNS,
  SCHEMA_ENUMS,
  SCHEMA_FOREIGN_KEYS,
  SCHEMA_UNIQUES,
  type SchemaCapabilityBundle,
} from './schema-capability-bundles.js';
import {
  readSchemaMetadata,
  type SchemaCapabilityClient,
  type SchemaCapabilityRuntime,
  type SchemaMetadata,
} from './schema-capability-metadata.js';
import { canonicalCheck } from './schema-check-expression.js';

export type { SchemaCapabilityBundle } from './schema-capability-bundles.js';
export type { SchemaCapabilityRuntime } from './schema-capability-metadata.js';
export interface KnownSchemaCapabilities {
  readonly status: 'known';
  readonly checkedAt: number;
  /** Missing individual columns are false; do not infer them from a whole bundle. */
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly bundles: Readonly<Record<SchemaCapabilityBundle, boolean>>;
}
export interface UnknownSchemaCapabilities {
  readonly status: 'unknown';
  readonly checkedAt: number;
  readonly diagnostic: 'METADATA_UNAVAILABLE';
}
export type SchemaCapabilitySnapshot =
  KnownSchemaCapabilities | UnknownSchemaCapabilities;

export class SchemaCapabilityUnavailableException extends ServiceUnavailableException {
  constructor(
    operation: string,
    diagnostic: 'SCHEMA_INCOMPLETE' | 'SCHEMA_UNKNOWN',
  ) {
    super({
      statusCode: 503,
      code: 'SCHEMA_CAPABILITY_UNAVAILABLE',
      operation,
      diagnostic,
      message:
        diagnostic === 'SCHEMA_INCOMPLETE'
          ? 'Operación bloqueada por una actualización pendiente del sistema. Solicite al administrador completar la actualización y vuelva a intentarlo.'
          : 'No se pudo verificar la disponibilidad de esta operación. Vuelva a intentarlo; si persiste, contacte al administrador.',
    });
  }
}

/** Only explicit PostgreSQL undefined-column/table codes, including native cause envelopes. */
function isSchemaReadFailure(error: unknown): boolean {
  const seen = new Set<object>();
  while (error && typeof error === 'object' && !seen.has(error)) {
    seen.add(error);
    const value = error as {
      code?: unknown;
      sqlState?: unknown;
      cause?: unknown;
    };
    if (
      [value.code, value.sqlState].some(
        (code) => code === '42703' || code === '42P01',
      )
    )
      return true;
    error = value.cause;
  }
  return false;
}

const sameColumns = (actual: readonly string[], expected: readonly string[]) =>
  actual.length === expected.length &&
  actual.every((name, i) => name === expected[i]);

/** Accept only the two deparses of the migration's text IN checks. Not label substring matching. */
function enumCheck(
  expression: string | null,
  column: string,
  values: readonly string[],
): boolean {
  if (expression === null) return false;
  const normalized = expression
    .split(/('(?:''|[^'])*')/)
    .map((part, index) =>
      index % 2 ? part : part.replace(/::text\b/g, '').replace(/[\s()"]/g, ''),
    )
    .join('');
  const labels = values.map((v) => `'${v}'`).join(',');
  return (
    normalized === `${column}=ANYARRAY[${labels}]` ||
    normalized === `${column}IN${labels}`
  );
}

function evaluate(
  metadata: SchemaMetadata,
  checkedAt: number,
): KnownSchemaCapabilities {
  const capabilities: Record<string, boolean> = {};
  for (const [table, columns] of Object.entries(SCHEMA_COLUMNS)) {
    capabilities[`table:${table}`] = metadata.tables.includes(table);
    for (const [name, expected] of Object.entries(columns)) {
      capabilities[`column:${table}.${name}`] =
        metadata.tables.includes(table) &&
        metadata.columns.some(
          (c) =>
            c.table === table &&
            c.name === name &&
            c.type === expected.type &&
            c.nullable === expected.nullable,
        );
    }
  }
  for (const e of SCHEMA_ENUMS) {
    capabilities[`enum:${e.table}.${e.column}`] = metadata.constraints.some(
      (c) =>
        c.table === e.table &&
        c.kind === 'c' &&
        c.validated &&
        sameColumns(c.columns, [e.column]) &&
        enumCheck(c.expression, e.column, e.values),
    );
  }
  for (const check of SCHEMA_CHECKS) {
    const expected = canonicalCheck(check.expression);
    capabilities[`check:${check.key}`] = expected !== null && metadata.constraints.some(c =>
      c.table === check.table && c.kind === 'c' && c.validated &&
      canonicalCheck(c.expression) === expected,
    );
  }
  for (const u of SCHEMA_UNIQUES) {
    capabilities[`unique:${u.name}`] = metadata.constraints.some(
      (c) =>
        c.table === u.table &&
        c.kind === u.kind &&
        c.validated &&
        !c.deferred &&
        sameColumns(c.columns, u.columns),
    );
  }
  for (const f of SCHEMA_FOREIGN_KEYS) {
    capabilities[`foreignKey:${f.table}_${f.column}_fkey`] =
      metadata.constraints.some(
        (c) =>
          c.table === f.table &&
          c.kind === 'f' &&
          c.validated &&
          !c.deferred &&
          sameColumns(c.columns, [f.column]) &&
          c.targetSchema === 'public' &&
          c.target === f.target &&
          sameColumns(c.targetColumns, ['id']) &&
          c.onDelete === 'r' &&
          c.onUpdate === 'c',
      );
  }
  const bundles = Object.fromEntries(
    Object.entries(SCHEMA_CAPABILITY_BUNDLES).map(([name, requirements]) => [
      name,
      requirements.every((key) => capabilities[key] === true),
    ]),
  ) as Record<SchemaCapabilityBundle, boolean>;
  return Object.freeze({
    status: 'known',
    checkedAt,
    capabilities: Object.freeze(capabilities),
    bundles: Object.freeze(bundles),
  });
}

/** Lazy, process-local provider. Explicit runtimes always bypass and never populate shared cache. */
export class SchemaCapabilities {
  private cached?: KnownSchemaCapabilities;
  private pending?: Promise<SchemaCapabilitySnapshot>;
  private generation = 0;
  private readonly ttl = 30_000;

  constructor(
    private readonly client: SchemaCapabilityClient,
    private readonly now = Date.now,
  ) {}

  invalidate(): void {
    this.generation++;
    this.cached = undefined;
    this.pending = undefined;
  }

  async snapshot(
    runtime?: SchemaCapabilityRuntime,
  ): Promise<SchemaCapabilitySnapshot> {
    if (runtime) return this.inspect(runtime);
    if (this.cached && this.now() - this.cached.checkedAt < this.ttl)
      return this.cached;
    if (this.pending) return this.pending;
    const generation = this.generation;
    const pending = this.inspect().then((snapshot) => {
      if (this.generation === generation && snapshot.status === 'known')
        this.cached = snapshot;
      return snapshot;
    });
    this.pending = pending;
    try {
      return await pending;
    } finally {
      if (this.pending === pending) this.pending = undefined;
    }
  }

  async assert(
    bundle: SchemaCapabilityBundle,
    operation: string,
    runtime?: SchemaCapabilityRuntime,
  ): Promise<KnownSchemaCapabilities> {
    const snapshot = this.requireKnown(await this.snapshot(runtime), operation);
    if (!snapshot.bundles[bundle])
      throw new SchemaCapabilityUnavailableException(
        operation,
        'SCHEMA_INCOMPLETE',
      );
    return snapshot;
  }

  /** Call only after the owning transaction has rolled back. Never reuse its
   * runtime or retry work: SQLSTATE alone does not prove a missing dependency.
   */
  async rethrowAfterRollback(
    error: unknown,
    bundles: readonly SchemaCapabilityBundle[],
    operation: string,
  ): Promise<never> {
    if (!isSchemaReadFailure(error)) throw error;
    this.invalidate();
    const snapshot = this.requireKnown(await this.snapshot(), operation);
    if (bundles.some((bundle) => !snapshot.bundles[bundle]))
      throw new SchemaCapabilityUnavailableException(
        operation,
        'SCHEMA_INCOMPLETE',
      );
    throw error;
  }

  /** Read-only, outside failed transactions. At most one retry; never retry writes.
   * Recreate the whole read in each callback. A failed PostgreSQL transaction must
   * be rolled back by the caller, not reused for metadata checks or fallback.
   */
  async read<T>(
    bundle: SchemaCapabilityBundle,
    operation: string,
    primary: (snapshot: KnownSchemaCapabilities) => Promise<T>,
    fallback: (snapshot: KnownSchemaCapabilities) => Promise<T>,
  ): Promise<T> {
    let snapshot = this.requireKnown(await this.snapshot(), operation);
    try {
      return await (snapshot.bundles[bundle]
        ? primary(snapshot)
        : fallback(snapshot));
    } catch (error) {
      if (!isSchemaReadFailure(error)) throw error;
      this.invalidate();
      snapshot = this.requireKnown(await this.snapshot(), operation);
      // A confirmed complete bundle cannot justify hiding an unrelated SQL bug.
      if (snapshot.bundles[bundle]) return primary(snapshot);
      return fallback(snapshot);
    }
  }

  private requireKnown(
    snapshot: SchemaCapabilitySnapshot,
    operation: string,
  ): KnownSchemaCapabilities {
    if (snapshot.status === 'unknown')
      throw new SchemaCapabilityUnavailableException(
        operation,
        'SCHEMA_UNKNOWN',
      );
    return snapshot;
  }

  private async inspect(
    runtime?: SchemaCapabilityRuntime,
  ): Promise<SchemaCapabilitySnapshot> {
    try {
      return evaluate(
        await readSchemaMetadata(this.client, runtime ?? this.client.runtime()),
        this.now(),
      );
    } catch {
      // Neither negative cache nor fallback on network, permission, SQL or decoding failures.
      return Object.freeze({
        status: 'unknown',
        checkedAt: this.now(),
        diagnostic: 'METADATA_UNAVAILABLE',
      });
    }
  }
}
