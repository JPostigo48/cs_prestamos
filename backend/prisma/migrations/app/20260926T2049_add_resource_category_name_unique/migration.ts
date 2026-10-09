#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/46dfe80fa0d1d43d0647c5b74220876e5313bcf4ca486f7f3fef043ffd06c1f5/contract';
import endContract from '../../snapshots/46dfe80fa0d1d43d0647c5b74220876e5313bcf4ca486f7f3fef043ffd06c1f5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8b3fc545ac268a096596a6f90ad53442d955beb4fe7a67062546a520c4123218/contract';
import startContract from '../../snapshots/8b3fc545ac268a096596a6f90ad53442d955beb4fe7a67062546a520c4123218/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addUnique({
        schema: 'public',
        table: 'recursos',
        constraint: 'recursos_categoriaId_nombre_key',
        columns: ['categoriaId', 'nombre'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
