#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/725045158a1eb09b9706712c0deb5116e7a7b2e81737e71752b7db32e2ff93c3/contract';
import startContract from '../../snapshots/725045158a1eb09b9706712c0deb5116e7a7b2e81737e71752b7db32e2ff93c3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/833c09d2fe681e01204af9ee9e6fbdb340ef038337911aad829bcef29d48d409/contract';
import endContract from '../../snapshots/833c09d2fe681e01204af9ee9e6fbdb340ef038337911aad829bcef29d48d409/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'solicitudes_registro',
        column: col('telefono', 'character varying(20)', {
          codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 20 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
