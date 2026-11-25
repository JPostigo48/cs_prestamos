#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/21bf2bbc35dc01507a1ee4e804cfa31bde531b5023de21adc4a21e09e27ea036/contract';
import startContract from '../../snapshots/21bf2bbc35dc01507a1ee4e804cfa31bde531b5023de21adc4a21e09e27ea036/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cc2b201bafbcbb0245956beddd7a63637bab481b2272a588f6a6747324bb3b48/contract';
import endContract from '../../snapshots/cc2b201bafbcbb0245956beddd7a63637bab481b2272a588f6a6747324bb3b48/contract.json' with { type: 'json' };
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
      this.dropCheckConstraint({
        schema: 'public',
        table: 'prestamos',
        constraint: 'prestamos_estado_check_005a5bcd',
      }),
      this.createTable({
        schema: 'public',
        table: 'ajustes_incumplimiento',
        columns: [
          col('actor', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('calendarioAnterior', 'jsonb', {
            notNull: true,
            codecRef: { codecId: 'pg/jsonb@1' },
          }),
          col('calendarioPosterior', 'jsonb', {
            notNull: true,
            codecRef: { codecId: 'pg/jsonb@1' },
          }),
          col('contexto', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('descuentoEfectivo', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('duracionTotalDias', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('efecto', 'character varying(20)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 20 } },
          }),
          col('fechaEfectiva', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('incrementoDias', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('incrementoNominal', 'numeric(5,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('incumplimientoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('nominalObjetivo', 'numeric(5,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('saldoAnterior', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('saldoPosterior', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('severidad', 'character varying(40)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 40 } },
          }),
          col('versionReglaId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ajustes_efecto_check_bddadac4',
            '(efecto = \'SET_ZERO\' AND "nominalObjetivo" IS NULL AND "incrementoNominal" IS NULL AND "duracionTotalDias" IS NULL AND "incrementoDias" IS NULL AND "saldoPosterior" = 0) OR (efecto = \'DISCOUNT\' AND "nominalObjetivo" BETWEEN 0 AND 100 AND "incrementoNominal" BETWEEN 0 AND "nominalObjetivo" AND "duracionTotalDias" > 0 AND "incrementoDias" BETWEEN 0 AND "duracionTotalDias")',
          ),
          checkExpression(
            'ajustes_saldos_check_2259aaf4',
            '"descuentoEfectivo" >= 0 AND "saldoAnterior" BETWEEN 0 AND 100 AND "saldoPosterior" BETWEEN 0 AND 100 AND "saldoAnterior" - "saldoPosterior" = "descuentoEfectivo"',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'cierres_prestamo',
        columns: [
          col('actor', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('contexto', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('fechaEfectiva', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('inspeccion', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('prestamoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('recompensa', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('requestHash', 'character varying(64)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 64 } },
          }),
          col('requestId', 'character varying(120)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('resultado', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'ejemplares',
        column: col('condicionFisica', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ejemplares',
        column: col('habilitado', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'incumplimientos',
        column: col('categoriaId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'incumplimientos',
        column: col('origen', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'incumplimientos',
        column: col('prestamoId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'incumplimientos',
        column: col('termsVersionId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'ajustes_incumplimiento',
        constraint: 'ajustes_incumplimiento_incumplimientoId_severidad_versionReglaId_key',
        columns: ['incumplimientoId', 'severidad', 'versionReglaId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cierres_prestamo',
        constraint: 'cierres_prestamo_prestamoId_key',
        columns: ['prestamoId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cierres_prestamo',
        constraint: 'cierres_prestamo_requestId_key',
        columns: ['requestId'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ejemplares',
        constraint: 'ejemplares_condicionFisica_check_aa4d7703',
        expression:
          "\"condicionFisica\" IN ('APTO', 'DANADO', 'INCOMPLETO', 'DANADO_E_INCOMPLETO', 'PERDIDO', 'ROBADO')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'incumplimientos',
        constraint: 'incumplimientos_episodio_contexto_check_431bd0a6',
        expression:
          '("prestamoId" IS NULL AND origen IS NULL) OR ("prestamoId" IS NOT NULL AND "categoriaId" IS NOT NULL AND "termsVersionId" IS NOT NULL AND origen IS NOT NULL)',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'incumplimientos',
        constraint: 'incumplimientos_origen_check_79efc0b3',
        expression: "\"origen\" IN ('MORA', 'DANO', 'PERDIDA')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'incumplimientos',
        constraint: 'incumplimientos_prestamoId_origen_key',
        columns: ['prestamoId', 'origen'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'prestamos',
        constraint: 'prestamos_estado_check_c9163860',
        expression:
          "\"estado\" IN ('PLANIFICADO', 'ACTIVO', 'FINALIZADO', 'CERRADO_POR_INCIDENCIA')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'ajustes_incumplimiento',
        index: 'ajustes_incumplimiento_incumplimientoId_idx_0499e809',
        columns: ['incumplimientoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ajustes_incumplimiento',
        index: 'ajustes_incumplimiento_versionReglaId_idx_e53cdbcf',
        columns: ['versionReglaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incumplimientos',
        index: 'incumplimientos_categoriaId_idx_63b46427',
        columns: ['categoriaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incumplimientos',
        index: 'incumplimientos_categoriaId_termsVersionId_origen_idx_9e61a3f8',
        columns: ['categoriaId', 'termsVersionId', 'origen'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incumplimientos',
        index: 'incumplimientos_prestamoId_idx_8ecc28bd',
        columns: ['prestamoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incumplimientos',
        index: 'incumplimientos_termsVersionId_idx_d60c13f5',
        columns: ['termsVersionId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ajustes_incumplimiento',
        foreignKey: {
          name: 'ajustes_incumplimiento_incumplimientoId_fkey',
          columns: ['incumplimientoId'],
          references: { schema: 'public', table: 'incumplimientos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ajustes_incumplimiento',
        foreignKey: {
          name: 'ajustes_incumplimiento_versionReglaId_fkey',
          columns: ['versionReglaId'],
          references: { schema: 'public', table: 'versiones_regla', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cierres_prestamo',
        foreignKey: {
          name: 'cierres_prestamo_prestamoId_fkey',
          columns: ['prestamoId'],
          references: { schema: 'public', table: 'prestamos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'incumplimientos',
        foreignKey: {
          name: 'incumplimientos_categoriaId_fkey',
          columns: ['categoriaId'],
          references: { schema: 'public', table: 'categorias_recurso', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'incumplimientos',
        foreignKey: {
          name: 'incumplimientos_prestamoId_fkey',
          columns: ['prestamoId'],
          references: { schema: 'public', table: 'prestamos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'incumplimientos',
        foreignKey: {
          name: 'incumplimientos_termsVersionId_fkey',
          columns: ['termsVersionId'],
          references: { schema: 'public', table: 'versiones_terminos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
