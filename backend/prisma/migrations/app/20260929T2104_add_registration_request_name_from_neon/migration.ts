#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/128b324a74e022b7d6e6912045b8319c609c883c350a0634ed29fa2dfc50e66a/contract';
import endContract from '../../snapshots/128b324a74e022b7d6e6912045b8319c609c883c350a0634ed29fa2dfc50e66a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/46dfe80fa0d1d43d0647c5b74220876e5313bcf4ca486f7f3fef043ffd06c1f5/contract';
import startContract from '../../snapshots/46dfe80fa0d1d43d0647c5b74220876e5313bcf4ca486f7f3fef043ffd06c1f5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'solicitudes_registro',
        column: col('nombre', 'character varying(180)', {
          codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 180 } },
        }),
      }),
      this.setNotNull({ schema: 'public', table: 'solicitudes_registro', column: 'nombre' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
