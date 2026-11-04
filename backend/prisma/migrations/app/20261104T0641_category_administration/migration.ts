#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/833c09d2fe681e01204af9ee9e6fbdb340ef038337911aad829bcef29d48d409/contract';
import startContract from '../../snapshots/833c09d2fe681e01204af9ee9e6fbdb340ef038337911aad829bcef29d48d409/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e2eecaa019ada800e7b6f6b64c7a56ae6f0b3064370dff430cad8052e96eccc8/contract';
import endContract from '../../snapshots/e2eecaa019ada800e7b6f6b64c7a56ae6f0b3064370dff430cad8052e96eccc8/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'categorias_recurso',
        column: col('activo', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'categorias_recurso',
        column: col('descripcion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'recursos',
        column: col('activo', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
