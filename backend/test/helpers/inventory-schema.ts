import {
  SCHEMA_COLUMNS,
  SCHEMA_ENUMS,
} from '../../src/shared/infrastructure/prisma/schema-capability-bundles.js';
import type { SchemaMetadata } from '../../src/shared/infrastructure/prisma/schema-capability-metadata.js';
import type { InventoryCompatibility } from '../../src/modules/inventory/domain/entities/inventory-compatibility.js';

/** Explicit complete physical-state schema fixture; unrelated episode tables are absent. */
export function inventorySchema(
  columns = ['condicionFisica', 'habilitado'],
  checks = true,
): SchemaMetadata {
  const physical = SCHEMA_ENUMS[0];
  return {
    tables: ['ejemplares'],
    columns: Object.entries(SCHEMA_COLUMNS.ejemplares)
      .filter(([name]) => columns.includes(name))
      .map(([name, spec]) => ({ table: 'ejemplares', name, ...spec })),
    constraints: checks
      ? [
          {
            table: 'ejemplares',
            name: 'physical_check',
            kind: 'c',
            columns: ['condicionFisica'],
            validated: true,
            deferred: false,
            expression: `("condicionFisica" IN (${physical.values.map((v) => `'${v}'`).join(',')}))`,
            targetSchema: null,
            target: null,
            targetColumns: [],
            onDelete: ' ',
            onUpdate: ' ',
          },
        ]
      : [],
  };
}

export const readyInventoryCompatibility: InventoryCompatibility = {
  status: 'READY',
  message: null,
  capabilities: {
    physicalCondition: true,
    administrativeEnablement: true,
    verifiedAvailability: true,
  },
  actions: {
    descriptiveEdits: true,
    create: true,
    activate: true,
    release: true,
    rehabilitate: true,
    manageCopy: true,
  },
};
