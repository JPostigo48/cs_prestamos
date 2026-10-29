#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/a178344edfb6852659fe25d345c482d7a0ab5a88f22c94fd4c46876a2120069d/contract';
import endContract from '../../snapshots/a178344edfb6852659fe25d345c482d7a0ab5a88f22c94fd4c46876a2120069d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/cad1da901fd9b5b506ffe9c5dded5ffe9d75f4e8f0d919360a03adda5c3a60f2/contract';
import startContract from '../../snapshots/cad1da901fd9b5b506ffe9c5dded5ffe9d75f4e8f0d919360a03adda5c3a60f2/contract.json' with { type: 'json' };
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
        table: 'accesorios_recurso',
        columns: [
          col('activo', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('nombre', 'character varying(120)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('nombreNormalizado', 'character varying(120)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('recursoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'accesorios_nombre_check_a992a93f',
            'length(btrim("nombre")) BETWEEN 1 AND 120',
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'recursos',
        column: col('duracionPrestamoHoras', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'accesorios_recurso',
        constraint: 'accesorios_recurso_recursoId_nombreNormalizado_key',
        columns: ['recursoId', 'nombreNormalizado'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'recursos',
        constraint: 'recursos_duracion_individual_check_986e56a0',
        expression:
          '"duracionPrestamoHoras" IS NULL OR "duracionPrestamoHoras" BETWEEN 1 AND 2147483647',
      }),
      this.createIndex({
        schema: 'public',
        table: 'accesorios_recurso',
        index: 'accesorios_recurso_recursoId_idx_24de29ee',
        columns: ['recursoId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'accesorios_recurso',
        foreignKey: {
          name: 'accesorios_recurso_recursoId_fkey',
          columns: ['recursoId'],
          references: { schema: 'public', table: 'recursos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
