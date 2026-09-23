#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8b3fc545ac268a096596a6f90ad53442d955beb4fe7a67062546a520c4123218/contract';
import endContract from '../../snapshots/8b3fc545ac268a096596a6f90ad53442d955beb4fe7a67062546a520c4123218/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'aceptaciones_terminos',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('fecha', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('usuarioId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('versionTerminosId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'apelaciones',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('estado', 'text', {
            notNull: true,
            default: lit('PENDIENTE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('fecha', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('fechaResolucion', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('incumplimientoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('motivo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resolucion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('resueltaPorCuentaId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('usuarioId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'apelaciones_estado_check_2419a1ff',
            "\"estado\" IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'categorias_recurso',
        columns: [
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
          col('tiempoMaximoPrestamoDias', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'cuentas_acceso',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('email', 'character varying(254)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 254 } },
          }),
          col('habilitada', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('passwordHash', 'character varying(255)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 255 } },
          }),
          col('rol', 'text', {
            notNull: true,
            default: lit('USUARIO'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('ultimoAcceso', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('usuarioId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'cuentas_acceso_rol_check_cef7fc7b',
            "\"rol\" IN ('USUARIO', 'OPERADOR', 'ADMINISTRADOR')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'devoluciones',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('fecha', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('observacion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('prestamoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ejemplares',
        columns: [
          col('codigoInventario', 'character varying(80)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 80 } },
          }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('estado', 'text', {
            notNull: true,
            default: lit('DISPONIBLE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('recursoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ejemplares_estado_check_dcc20e51',
            "\"estado\" IN ('DISPONIBLE', 'PRESTADO', 'NO_DISPONIBLE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'evidencias_vinculacion',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('informacion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('solicitudRegistroId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'incumplimientos',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('fecha', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('penalizacionAplicada', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('reglaId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('usuarioId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('versionReglaId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'observaciones_ejemplar',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('descripcion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ejemplarId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('fecha', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'prestamos',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('ejemplarId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('estado', 'text', {
            notNull: true,
            default: lit('PLANIFICADO'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('fechaFin', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('fechaInicio', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('usuarioId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'prestamos_estado_check_005a5bcd',
            "\"estado\" IN ('PLANIFICADO', 'ACTIVO', 'FINALIZADO')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'recursos',
        columns: [
          col('categoriaId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('descripcion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('nombre', 'character varying(180)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 180 } },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'reglas_uso',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('versionVigenteId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'sanciones',
        columns: [
          col('confianzaAnterior', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('confianzaPosterior', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('estado', 'text', {
            notNull: true,
            default: lit('ACTIVA'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('fechaFin', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('fechaInicio', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('incumplimientoId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('reglaId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('usuarioId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('versionReglaId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'sanciones_estado_check_5348962d',
            "\"estado\" IN ('ACTIVA', 'FINALIZADA')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'solicitudes_registro',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('estado', 'text', {
            notNull: true,
            default: lit('PENDIENTE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('fechaSolicitud', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('identificadorInstitucional', 'character varying(80)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 80 } },
          }),
          col('tipoUsuario', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('usuarioAprobadoId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'solicitudes_registro_estado_check_e1c39414',
            "\"estado\" IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')",
          ),
          checkExpression(
            'solicitudes_registro_tipoUsuario_check_70fac5a9',
            "\"tipoUsuario\" IN ('ESTUDIANTE', 'DOCENTE', 'ADMINISTRATIVO')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'usuarios',
        columns: [
          col('confianza', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('identificadorInstitucional', 'character varying(80)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 80 } },
          }),
          col('nombre', 'character varying(180)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 180 } },
          }),
          col('tipoUsuario', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('vinculacionVigente', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'usuarios_tipoUsuario_check_70fac5a9',
            "\"tipoUsuario\" IN ('ESTUDIANTE', 'DOCENTE', 'ADMINISTRATIVO')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'versiones_regla',
        columns: [
          col('consecuencia', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('descripcion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('estado', 'text', {
            notNull: true,
            default: lit('ACTIVA'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('numero', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('penalizacionPorcentual', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('reglaId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('titulo', 'character varying(180)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 180 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'versiones_regla_estado_check_1cb87e59',
            "\"estado\" IN ('ACTIVA', 'INACTIVA')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'versiones_terminos',
        columns: [
          col('contenido', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('numero', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('titulo', 'character varying(180)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 180 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'aceptaciones_terminos',
        constraint: 'aceptaciones_terminos_usuarioId_versionTerminosId_key',
        columns: ['usuarioId', 'versionTerminosId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'apelaciones',
        constraint: 'apelaciones_incumplimientoId_key',
        columns: ['incumplimientoId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'categorias_recurso',
        constraint: 'categorias_recurso_nombre_key',
        columns: ['nombre'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cuentas_acceso',
        constraint: 'cuentas_acceso_usuarioId_key',
        columns: ['usuarioId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cuentas_acceso',
        constraint: 'cuentas_acceso_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'devoluciones',
        constraint: 'devoluciones_prestamoId_key',
        columns: ['prestamoId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ejemplares',
        constraint: 'ejemplares_codigoInventario_key',
        columns: ['codigoInventario'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'reglas_uso',
        constraint: 'reglas_uso_versionVigenteId_key',
        columns: ['versionVigenteId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'sanciones',
        constraint: 'sanciones_incumplimientoId_key',
        columns: ['incumplimientoId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'usuarios',
        constraint: 'usuarios_identificadorInstitucional_key',
        columns: ['identificadorInstitucional'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'versiones_regla',
        constraint: 'versiones_regla_reglaId_numero_key',
        columns: ['reglaId', 'numero'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'versiones_terminos',
        constraint: 'versiones_terminos_numero_key',
        columns: ['numero'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'aceptaciones_terminos',
        index: 'aceptaciones_terminos_usuarioId_fecha_idx_c02c2249',
        columns: ['usuarioId', 'fecha'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'aceptaciones_terminos',
        index: 'aceptaciones_terminos_usuarioId_idx_5f01c7d6',
        columns: ['usuarioId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'aceptaciones_terminos',
        index: 'aceptaciones_terminos_versionTerminosId_idx_37ad6954',
        columns: ['versionTerminosId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'apelaciones',
        index: 'apelaciones_estado_fecha_idx_14aede9c',
        columns: ['estado', 'fecha'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'apelaciones',
        index: 'apelaciones_resueltaPorCuentaId_idx_eefb237e',
        columns: ['resueltaPorCuentaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'apelaciones',
        index: 'apelaciones_usuarioId_estado_idx_e25db20e',
        columns: ['usuarioId', 'estado'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'apelaciones',
        index: 'apelaciones_usuarioId_idx_5f01c7d6',
        columns: ['usuarioId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cuentas_acceso',
        index: 'cuentas_acceso_rol_habilitada_idx_493fb567',
        columns: ['rol', 'habilitada'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ejemplares',
        index: 'ejemplares_estado_idx_c74e5888',
        columns: ['estado'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ejemplares',
        index: 'ejemplares_recursoId_estado_idx_7662cf35',
        columns: ['recursoId', 'estado'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ejemplares',
        index: 'ejemplares_recursoId_idx_24de29ee',
        columns: ['recursoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'evidencias_vinculacion',
        index: 'evidencias_vinculacion_solicitudRegistroId_idx_583e08f8',
        columns: ['solicitudRegistroId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incumplimientos',
        index: 'incumplimientos_reglaId_idx_b6d54101',
        columns: ['reglaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incumplimientos',
        index: 'incumplimientos_reglaId_versionReglaId_idx_6f818c35',
        columns: ['reglaId', 'versionReglaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incumplimientos',
        index: 'incumplimientos_usuarioId_fecha_idx_c02c2249',
        columns: ['usuarioId', 'fecha'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incumplimientos',
        index: 'incumplimientos_usuarioId_idx_5f01c7d6',
        columns: ['usuarioId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incumplimientos',
        index: 'incumplimientos_versionReglaId_idx_e53cdbcf',
        columns: ['versionReglaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'observaciones_ejemplar',
        index: 'observaciones_ejemplar_ejemplarId_fecha_idx_f07accfe',
        columns: ['ejemplarId', 'fecha'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'observaciones_ejemplar',
        index: 'observaciones_ejemplar_ejemplarId_idx_3f5f7f14',
        columns: ['ejemplarId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'prestamos',
        index: 'prestamos_ejemplarId_estado_fechaInicio_fechaFin_idx_bf9856f0',
        columns: ['ejemplarId', 'estado', 'fechaInicio', 'fechaFin'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'prestamos',
        index: 'prestamos_ejemplarId_idx_3f5f7f14',
        columns: ['ejemplarId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'prestamos',
        index: 'prestamos_fechaFin_estado_idx_e1e0a96c',
        columns: ['fechaFin', 'estado'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'prestamos',
        index: 'prestamos_usuarioId_estado_idx_e25db20e',
        columns: ['usuarioId', 'estado'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'prestamos',
        index: 'prestamos_usuarioId_idx_5f01c7d6',
        columns: ['usuarioId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recursos',
        index: 'recursos_categoriaId_idx_63b46427',
        columns: ['categoriaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recursos',
        index: 'recursos_nombre_idx_bdfaa3b5',
        columns: ['nombre'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sanciones',
        index: 'sanciones_estado_fechaFin_idx_eb91b5fc',
        columns: ['estado', 'fechaFin'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sanciones',
        index: 'sanciones_reglaId_idx_b6d54101',
        columns: ['reglaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sanciones',
        index: 'sanciones_usuarioId_estado_idx_e25db20e',
        columns: ['usuarioId', 'estado'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sanciones',
        index: 'sanciones_usuarioId_idx_5f01c7d6',
        columns: ['usuarioId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sanciones',
        index: 'sanciones_versionReglaId_idx_e53cdbcf',
        columns: ['versionReglaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'solicitudes_registro',
        index: 'solicitudes_registro_estado_fechaSolicitud_idx_f51fd43b',
        columns: ['estado', 'fechaSolicitud'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'solicitudes_registro',
        index: 'solicitudes_registro_identificadorInstitucional_idx_5f85242c',
        columns: ['identificadorInstitucional'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'solicitudes_registro',
        index: 'solicitudes_registro_usuarioAprobadoId_idx_7a4e46d6',
        columns: ['usuarioAprobadoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usuarios',
        index: 'usuarios_tipoUsuario_idx_c9896586',
        columns: ['tipoUsuario'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usuarios',
        index: 'usuarios_vinculacionVigente_idx_c0f1be4e',
        columns: ['vinculacionVigente'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'versiones_regla',
        index: 'versiones_regla_estado_idx_c74e5888',
        columns: ['estado'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'versiones_regla',
        index: 'versiones_regla_reglaId_estado_idx_3769a545',
        columns: ['reglaId', 'estado'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'versiones_regla',
        index: 'versiones_regla_reglaId_idx_b6d54101',
        columns: ['reglaId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'aceptaciones_terminos',
        foreignKey: {
          name: 'aceptaciones_terminos_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuarios', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'aceptaciones_terminos',
        foreignKey: {
          name: 'aceptaciones_terminos_versionTerminosId_fkey',
          columns: ['versionTerminosId'],
          references: { schema: 'public', table: 'versiones_terminos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'apelaciones',
        foreignKey: {
          name: 'apelaciones_incumplimientoId_fkey',
          columns: ['incumplimientoId'],
          references: { schema: 'public', table: 'incumplimientos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'apelaciones',
        foreignKey: {
          name: 'apelaciones_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuarios', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'apelaciones',
        foreignKey: {
          name: 'apelaciones_resueltaPorCuentaId_fkey',
          columns: ['resueltaPorCuentaId'],
          references: { schema: 'public', table: 'cuentas_acceso', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cuentas_acceso',
        foreignKey: {
          name: 'cuentas_acceso_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuarios', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'devoluciones',
        foreignKey: {
          name: 'devoluciones_prestamoId_fkey',
          columns: ['prestamoId'],
          references: { schema: 'public', table: 'prestamos', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ejemplares',
        foreignKey: {
          name: 'ejemplares_recursoId_fkey',
          columns: ['recursoId'],
          references: { schema: 'public', table: 'recursos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'evidencias_vinculacion',
        foreignKey: {
          name: 'evidencias_vinculacion_solicitudRegistroId_fkey',
          columns: ['solicitudRegistroId'],
          references: { schema: 'public', table: 'solicitudes_registro', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'incumplimientos',
        foreignKey: {
          name: 'incumplimientos_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuarios', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'incumplimientos',
        foreignKey: {
          name: 'incumplimientos_reglaId_fkey',
          columns: ['reglaId'],
          references: { schema: 'public', table: 'reglas_uso', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'incumplimientos',
        foreignKey: {
          name: 'incumplimientos_versionReglaId_fkey',
          columns: ['versionReglaId'],
          references: { schema: 'public', table: 'versiones_regla', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'observaciones_ejemplar',
        foreignKey: {
          name: 'observaciones_ejemplar_ejemplarId_fkey',
          columns: ['ejemplarId'],
          references: { schema: 'public', table: 'ejemplares', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'prestamos',
        foreignKey: {
          name: 'prestamos_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuarios', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'prestamos',
        foreignKey: {
          name: 'prestamos_ejemplarId_fkey',
          columns: ['ejemplarId'],
          references: { schema: 'public', table: 'ejemplares', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recursos',
        foreignKey: {
          name: 'recursos_categoriaId_fkey',
          columns: ['categoriaId'],
          references: { schema: 'public', table: 'categorias_recurso', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'reglas_uso',
        foreignKey: {
          name: 'reglas_uso_versionVigenteId_fkey',
          columns: ['versionVigenteId'],
          references: { schema: 'public', table: 'versiones_regla', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sanciones',
        foreignKey: {
          name: 'sanciones_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuarios', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sanciones',
        foreignKey: {
          name: 'sanciones_incumplimientoId_fkey',
          columns: ['incumplimientoId'],
          references: { schema: 'public', table: 'incumplimientos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sanciones',
        foreignKey: {
          name: 'sanciones_reglaId_fkey',
          columns: ['reglaId'],
          references: { schema: 'public', table: 'reglas_uso', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sanciones',
        foreignKey: {
          name: 'sanciones_versionReglaId_fkey',
          columns: ['versionReglaId'],
          references: { schema: 'public', table: 'versiones_regla', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'solicitudes_registro',
        foreignKey: {
          name: 'solicitudes_registro_usuarioAprobadoId_fkey',
          columns: ['usuarioAprobadoId'],
          references: { schema: 'public', table: 'usuarios', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'versiones_regla',
        foreignKey: {
          name: 'versiones_regla_reglaId_fkey',
          columns: ['reglaId'],
          references: { schema: 'public', table: 'reglas_uso', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
