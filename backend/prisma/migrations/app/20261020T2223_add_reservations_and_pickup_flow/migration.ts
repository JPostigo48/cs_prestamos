#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/852410ac28569b6d7378ebe1d98fe19b6a09cedac7146c5d6effa6780118dc61/contract';
import startContract from '../../snapshots/852410ac28569b6d7378ebe1d98fe19b6a09cedac7146c5d6effa6780118dc61/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b3b25fcc9264316e8464d7e5368e9bbf76fb6256503baa04ec389675df1afa98/contract';
import endContract from '../../snapshots/b3b25fcc9264316e8464d7e5368e9bbf76fb6256503baa04ec389675df1afa98/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'reservas',
        columns: [
          col('fechaCancelacion', 'timestamptz(3)', { codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } } }),
          col('createdAt', 'timestamptz(3)', { notNull: true, default: fn('now()'), codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } } }),
          col('ejemplarId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('estado', 'text', { notNull: true, default: lit('CONFIRMADA'), codecRef: { codecId: 'pg/text@1' } }),
          col('fechaLimiteRecogida', 'timestamptz(3)', { notNull: true, codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } } }),
          col('duracionPrestamoHoras', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('fechaRecogida', 'timestamptz(3)', { codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } } }),
          col('fechaSolicitada', 'timestamptz(3)', { notNull: true, codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('motivoCancelacion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', { notNull: true, codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('usuarioId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('reservas_estado_check_c75da3fc', "\"estado\" IN ('CONFIRMADA', 'RECOGIDA', 'CANCELADA', 'VENCIDA')"),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'prestamos',
        column: col('reservaId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'prestamos',
        constraint: 'prestamos_reservaId_key',
        columns: ['reservaId'],
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'ejemplares',
        constraint: 'ejemplares_estado_check_dcc20e51',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ejemplares',
        constraint: 'ejemplares_estado_check_edc0183f',
        expression: "\"estado\" IN ('DISPONIBLE', 'RESERVADO', 'PRESTADO', 'NO_DISPONIBLE')",
      }),
      this.createIndex({ schema: 'public', table: 'reservas', index: 'reservas_usuarioId_estado_idx_e25db20e', columns: ['usuarioId', 'estado'] }),
      this.createIndex({ schema: 'public', table: 'reservas', index: 'reservas_usuarioId_idx_5f01c7d6', columns: ['usuarioId'] }),
      this.createIndex({ schema: 'public', table: 'reservas', index: 'reservas_ejemplarId_estado_idx_9d636bd5', columns: ['ejemplarId', 'estado'] }),
      this.createIndex({ schema: 'public', table: 'reservas', index: 'reservas_ejemplarId_idx_3f5f7f14', columns: ['ejemplarId'] }),
      this.createIndex({ schema: 'public', table: 'reservas', index: 'reservas_estado_fechaLimiteRecogida_idx_5e3f6ed9', columns: ['estado', 'fechaLimiteRecogida'] }),
      this.addForeignKey({
        schema: 'public',
        table: 'reservas',
        foreignKey: {
          name: 'reservas_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuarios', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'reservas',
        foreignKey: {
          name: 'reservas_ejemplarId_fkey',
          columns: ['ejemplarId'],
          references: { schema: 'public', table: 'ejemplares', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'prestamos',
        foreignKey: {
          name: 'prestamos_reservaId_fkey',
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
