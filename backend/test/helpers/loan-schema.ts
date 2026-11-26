import {
  SCHEMA_COLUMNS, SCHEMA_ENUMS, SCHEMA_FOREIGN_KEYS, SCHEMA_UNIQUES,
} from '../../src/shared/infrastructure/prisma/schema-capability-bundles.js';
import type { SchemaMetadata } from '../../src/shared/infrastructure/prisma/schema-capability-metadata.js';
import { episodeChecks } from './episode-checks.js';

/** Explicit full physical schema for offline loan/episode fixtures. */
export function completeLoanSchema(): SchemaMetadata {
  const constraint = (input: Partial<SchemaMetadata['constraints'][number]>) => ({
    table: '', name: '', kind: 'c', columns: [] as string[], validated: true,
    deferred: false, expression: null as string | null, targetSchema: null as string | null,
    target: null as string | null, targetColumns: [] as string[], onDelete: ' ', onUpdate: ' ',
    ...input,
  });
  return {
    tables: Object.keys(SCHEMA_COLUMNS),
    columns: Object.entries(SCHEMA_COLUMNS).flatMap(([table, columns]) =>
      Object.entries(columns).map(([name, spec]) => ({ table, name, ...spec }))),
    constraints: [
      ...episodeChecks(),
      ...SCHEMA_ENUMS.map((e) => constraint({
        table: e.table, name: `${e.table}_check`, columns: [e.column],
        expression: `("${e.column}" IN (${e.values.map(v => `'${v}'`).join(',')}))`,
      })),
      ...SCHEMA_UNIQUES.map((u) => constraint({ ...u, columns: [...u.columns] })),
      ...SCHEMA_FOREIGN_KEYS.map((f) => constraint({
        table: f.table, name: `${f.table}_${f.column}_fkey`, kind: 'f',
        columns: [f.column], targetSchema: 'public', target: f.target,
        targetColumns: ['id'], onDelete: 'r', onUpdate: 'c',
      })),
    ],
  };
}
