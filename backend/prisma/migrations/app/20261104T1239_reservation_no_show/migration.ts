#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/21bf2bbc35dc01507a1ee4e804cfa31bde531b5023de21adc4a21e09e27ea036/contract';
import endContract from '../../snapshots/21bf2bbc35dc01507a1ee4e804cfa31bde531b5023de21adc4a21e09e27ea036/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/eca743e012de8105f60878524fed22a18af463d401c50d26f29b3b7a761af2e3/contract';
import startContract from '../../snapshots/eca743e012de8105f60878524fed22a18af463d401c50d26f29b3b7a761af2e3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'incumplimientos',
        column: col('reservaId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'incumplimientos',
        constraint: 'incumplimientos_reservaId_key',
        columns: ['reservaId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'incumplimientos',
        foreignKey: {
          name: 'incumplimientos_reservaId_fkey',
          columns: ['reservaId'],
          references: { schema: 'public', table: 'reservas', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
