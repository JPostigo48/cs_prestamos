import type { PrismaService } from './prisma.service.js';
import { SCHEMA_COLUMNS } from './schema-capability-bundles.js';

export type SchemaCapabilityRuntime = Pick<
  ReturnType<PrismaService['client']['runtime']>,
  'query'
>;
export interface SchemaCapabilityClient {
  readonly raw: PrismaService['client']['raw'];
  runtime(): SchemaCapabilityRuntime;
}

export interface SchemaMetadata {
  tables: string[];
  columns: { table: string; name: string; type: string; nullable: boolean }[];
  constraints: {
    table: string;
    name: string;
    kind: string;
    columns: string[];
    validated: boolean;
    deferred: boolean;
    expression: string | null;
    targetSchema: string | null;
    target: string | null;
    targetColumns: string[];
    onDelete: string;
    onUpdate: string;
  }[];
}

/** One statement gives one catalog snapshot; no user tables, DDL or migration ledger. */
export async function readSchemaMetadata(
  client: SchemaCapabilityClient,
  runtime: SchemaCapabilityRuntime,
): Promise<SchemaMetadata> {
  const schema = 'public';
  const tables = JSON.stringify(Object.keys(SCHEMA_COLUMNS));
  const plan = client.raw.sql`
    WITH relations AS (
      SELECT c.oid, c.relname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ${schema} AND c.relkind IN ('r', 'p')
        AND c.relname IN (SELECT jsonb_array_elements_text(${tables}::jsonb))
    )
    SELECT jsonb_build_object(
      'tables', COALESCE((SELECT jsonb_agg(relname) FROM relations), '[]'::jsonb),
      'columns', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'table', r.relname, 'name', a.attname,
          'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
          'nullable', NOT a.attnotnull))
        FROM relations r JOIN pg_catalog.pg_attribute a ON a.attrelid = r.oid
        WHERE a.attnum > 0 AND NOT a.attisdropped
      ), '[]'::jsonb),
      'constraints', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'table', r.relname, 'name', k.conname, 'kind', k.contype,
          'columns', COALESCE((SELECT jsonb_agg(a.attname ORDER BY x.ord)
            FROM unnest(k.conkey) WITH ORDINALITY x(num, ord)
            JOIN pg_catalog.pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = x.num), '[]'::jsonb),
          'validated', k.convalidated, 'deferred', k.condeferrable,
          'expression', pg_catalog.pg_get_expr(k.conbin, k.conrelid),
          'targetSchema', tn.nspname, 'target', tc.relname,
          'targetColumns', COALESCE((SELECT jsonb_agg(a.attname ORDER BY x.ord)
            FROM unnest(k.confkey) WITH ORDINALITY x(num, ord)
            JOIN pg_catalog.pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = x.num), '[]'::jsonb),
          'onDelete', k.confdeltype, 'onUpdate', k.confupdtype))
        FROM relations r JOIN pg_catalog.pg_constraint k ON k.conrelid = r.oid
        LEFT JOIN pg_catalog.pg_class tc ON tc.oid = k.confrelid
        LEFT JOIN pg_catalog.pg_namespace tn ON tn.oid = tc.relnamespace
      ), '[]'::jsonb)
    )::text AS metadata
  `
    .returnsRow({ metadata: 'pg/text@1' })
    .build();
  const rows = await runtime.query(plan);
  if (rows.length !== 1 || typeof rows[0]?.metadata !== 'string') {
    throw new Error('Invalid schema metadata result');
  }
  const data: unknown = JSON.parse(rows[0].metadata);
  validateMetadata(data);
  return data;
}

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v: unknown) => typeof v === 'string');
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

function validateMetadata(data: unknown): asserts data is SchemaMetadata {
  if (
    !record(data) ||
    !strings(data.tables) ||
    !Array.isArray(data.columns) ||
    !Array.isArray(data.constraints) ||
    !data.columns.every(
      (c: unknown) =>
        record(c) &&
        typeof c.table === 'string' &&
        typeof c.name === 'string' &&
        typeof c.type === 'string' &&
        typeof c.nullable === 'boolean',
    ) ||
    !data.constraints.every(
      (c: unknown) =>
        record(c) &&
        ['table', 'name', 'kind', 'onDelete', 'onUpdate'].every(
          (key) => typeof c[key] === 'string',
        ) &&
        ['expression', 'targetSchema', 'target'].every(
          (key) => c[key] === null || typeof c[key] === 'string',
        ) &&
        strings(c.columns) &&
        strings(c.targetColumns) &&
        typeof c.validated === 'boolean' &&
        typeof c.deferred === 'boolean',
    )
  ) {
    throw new Error('Invalid schema metadata shape');
  }
}
