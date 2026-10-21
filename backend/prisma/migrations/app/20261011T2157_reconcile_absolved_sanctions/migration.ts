#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0745075c442937a011808205cb2189c319e04342c2b83dd6b7aee663bd2e4416/contract';
import startContract from '../../snapshots/0745075c442937a011808205cb2189c319e04342c2b83dd6b7aee663bd2e4416/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/852410ac28569b6d7378ebe1d98fe19b6a09cedac7146c5d6effa6780118dc61/contract';
import endContract from '../../snapshots/852410ac28569b6d7378ebe1d98fe19b6a09cedac7146c5d6effa6780118dc61/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'sanciones',
        constraint: 'sanciones_estado_check_5348962d',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'sanciones',
        constraint: 'sanciones_estado_check_1e842a90',
        expression: `"estado" IN ('ACTIVA', 'FINALIZADA', 'ABSUELTA')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
