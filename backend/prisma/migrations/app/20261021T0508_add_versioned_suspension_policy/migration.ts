#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/584506ccbd3d0d08875bec17d1f1f6c2c7b393889985422e731514167818b65d/contract';
import endContract from '../../snapshots/584506ccbd3d0d08875bec17d1f1f6c2c7b393889985422e731514167818b65d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/902b5eb5f4a3ec1f8fae1702f121207c8960668d466c0131908b01a7a3b61483/contract';
import startContract from '../../snapshots/902b5eb5f4a3ec1f8fae1702f121207c8960668d466c0131908b01a7a3b61483/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'sanciones',
        constraint: 'sanciones_estado_check_1e842a90',
      }),
      this.addColumn({
        schema: 'public',
        table: 'versiones_regla',
        column: col('diasSuspension', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'versiones_regla',
        column: col('tipoSuspension', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'sanciones',
        constraint: 'sanciones_estado_check_1de51348',
        expression: "\"estado\" IN ('PROGRAMADA', 'ACTIVA', 'FINALIZADA', 'ABSUELTA')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'versiones_regla',
        constraint: 'versiones_regla_tipoSuspension_check_410b7d83',
        expression: "\"tipoSuspension\" IN ('NINGUNA', 'TEMPORAL', 'INDEFINIDA')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
