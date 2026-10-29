#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a178344edfb6852659fe25d345c482d7a0ab5a88f22c94fd4c46876a2120069d/contract';
import startContract from '../../snapshots/a178344edfb6852659fe25d345c482d7a0ab5a88f22c94fd4c46876a2120069d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e0c33fd71c119cb158d4634873f0d3f93f716172178cc687acbf5c5f982ff904/contract';
import endContract from '../../snapshots/e0c33fd71c119cb158d4634873f0d3f93f716172178cc687acbf5c5f982ff904/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'inspecciones_devolucion',
        columns: [
          col('actorId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('checkedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('configurationSnapshot', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('parts', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('prestamoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'prestamos',
        column: col('configurationSnapshot', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'reservas',
        column: col('configurationSnapshot', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'inspecciones_devolucion',
        constraint: 'inspecciones_devolucion_prestamoId_key',
        columns: ['prestamoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inspecciones_devolucion',
        index: 'inspecciones_devolucion_actorId_idx_a58f6b4b',
        columns: ['actorId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inspecciones_devolucion',
        foreignKey: {
          name: 'inspecciones_devolucion_prestamoId_fkey',
          columns: ['prestamoId'],
          references: { schema: 'public', table: 'prestamos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inspecciones_devolucion',
        foreignKey: {
          name: 'inspecciones_devolucion_actorId_fkey',
          columns: ['actorId'],
          references: { schema: 'public', table: 'usuarios', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
