#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3cf9d1df4dc3e1beccc614073cfd2522d8a7a9eb4aa054fce8aae35d82c9471c/contract';
import endContract from '../../snapshots/3cf9d1df4dc3e1beccc614073cfd2522d8a7a9eb4aa054fce8aae35d82c9471c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/584506ccbd3d0d08875bec17d1f1f6c2c7b393889985422e731514167818b65d/contract';
import startContract from '../../snapshots/584506ccbd3d0d08875bec17d1f1f6c2c7b393889985422e731514167818b65d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'apelaciones',
        column: col('sancionId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'apelaciones',
        constraint: 'apelaciones_sancionId_key',
        columns: ['sancionId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'apelaciones',
        foreignKey: {
          name: 'apelaciones_sancionId_fkey',
          columns: ['sancionId'],
          references: { schema: 'public', table: 'sanciones', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
