#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/725045158a1eb09b9706712c0deb5116e7a7b2e81737e71752b7db32e2ff93c3/contract';
import endContract from '../../snapshots/725045158a1eb09b9706712c0deb5116e7a7b2e81737e71752b7db32e2ff93c3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e0c33fd71c119cb158d4634873f0d3f93f716172178cc687acbf5c5f982ff904/contract';
import startContract from '../../snapshots/e0c33fd71c119cb158d4634873f0d3f93f716172178cc687acbf5c5f982ff904/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'evidencias_prestamo',
        columns: [
          col('cargadoPorCuentaId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('descripcion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('hash', 'character varying(64)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 64 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('mimeType', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('nombreOriginal', 'character varying(255)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 255 } },
          }),
          col('prestamoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('ruta', 'character varying(500)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 500 } },
          }),
          col('tamanoBytes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('tipo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'evidencias_prestamo_tipo_check_a8b33710',
            "\"tipo\" IN ('ENTREGA', 'DEVOLUCION', 'DANO', 'PERDIDA')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuarios',
        column: col('telefono', 'character varying(20)', {
          codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 20 } },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'evidencias_prestamo',
        index: 'evidencias_prestamo_cargadoPorCuentaId_createdAt_idx_8be0062c',
        columns: ['cargadoPorCuentaId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'evidencias_prestamo',
        index: 'evidencias_prestamo_cargadoPorCuentaId_idx_c70876c9',
        columns: ['cargadoPorCuentaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'evidencias_prestamo',
        index: 'evidencias_prestamo_prestamoId_idx_8ecc28bd',
        columns: ['prestamoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'evidencias_prestamo',
        index: 'evidencias_prestamo_prestamoId_tipo_createdAt_idx_e50f5f6c',
        columns: ['prestamoId', 'tipo', 'createdAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'evidencias_prestamo',
        foreignKey: {
          name: 'evidencias_prestamo_prestamoId_fkey',
          columns: ['prestamoId'],
          references: { schema: 'public', table: 'prestamos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'evidencias_prestamo',
        foreignKey: {
          name: 'evidencias_prestamo_cargadoPorCuentaId_fkey',
          columns: ['cargadoPorCuentaId'],
          references: { schema: 'public', table: 'cuentas_acceso', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
