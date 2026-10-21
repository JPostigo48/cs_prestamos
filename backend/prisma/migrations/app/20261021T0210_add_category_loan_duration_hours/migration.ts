#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/902b5eb5f4a3ec1f8fae1702f121207c8960668d466c0131908b01a7a3b61483/contract';
import endContract from '../../snapshots/902b5eb5f4a3ec1f8fae1702f121207c8960668d466c0131908b01a7a3b61483/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b3b25fcc9264316e8464d7e5368e9bbf76fb6256503baa04ec389675df1afa98/contract';
import startContract from '../../snapshots/b3b25fcc9264316e8464d7e5368e9bbf76fb6256503baa04ec389675df1afa98/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'categorias_recurso',
        column: col('tiempoMaximoPrestamoHoras', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
