#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0745075c442937a011808205cb2189c319e04342c2b83dd6b7aee663bd2e4416/contract';
import endContract from '../../snapshots/0745075c442937a011808205cb2189c319e04342c2b83dd6b7aee663bd2e4416/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/128b324a74e022b7d6e6912045b8319c609c883c350a0634ed29fa2dfc50e66a/contract';
import startContract from '../../snapshots/128b324a74e022b7d6e6912045b8319c609c883c350a0634ed29fa2dfc50e66a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'auditorias_usuario',
        columns: [
          col('accion', 'character varying(80)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 80 } },
          }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('datosAnteriores', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('datosNuevos', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fecha', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('motivo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('solicitudRegistroId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('usuarioId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'solicitudes_registro',
        column: col('motivoRechazo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'solicitudes_registro',
        constraint: 'solicitudes_registro_nombre_length_check_7b391dd1',
        expression: 'length(btrim("nombre")) >= 2',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'usuarios',
        constraint: 'usuarios_confianza_range_check_f2990dfd',
        expression: 'confianza >= 0 AND confianza <= 100',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'usuarios',
        constraint: 'usuarios_nombre_length_check_7b391dd1',
        expression: 'length(btrim("nombre")) >= 2',
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditorias_usuario',
        index: 'auditorias_usuario_accion_fecha_idx_10245029',
        columns: ['accion', 'fecha'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditorias_usuario',
        index: 'auditorias_usuario_solicitudRegistroId_fecha_idx_f1429454',
        columns: ['solicitudRegistroId', 'fecha'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditorias_usuario',
        index: 'auditorias_usuario_solicitudRegistroId_idx_583e08f8',
        columns: ['solicitudRegistroId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditorias_usuario',
        index: 'auditorias_usuario_usuarioId_fecha_idx_c02c2249',
        columns: ['usuarioId', 'fecha'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditorias_usuario',
        index: 'auditorias_usuario_usuarioId_idx_5f01c7d6',
        columns: ['usuarioId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'auditorias_usuario',
        foreignKey: {
          name: 'auditorias_usuario_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuarios', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'auditorias_usuario',
        foreignKey: {
          name: 'auditorias_usuario_solicitudRegistroId_fkey',
          columns: ['solicitudRegistroId'],
          references: { schema: 'public', table: 'solicitudes_registro', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
