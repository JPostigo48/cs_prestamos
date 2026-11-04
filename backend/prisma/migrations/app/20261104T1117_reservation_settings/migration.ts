#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/e2eecaa019ada800e7b6f6b64c7a56ae6f0b3064370dff430cad8052e96eccc8/contract';
import startContract from '../../snapshots/e2eecaa019ada800e7b6f6b64c7a56ae6f0b3064370dff430cad8052e96eccc8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/eca743e012de8105f60878524fed22a18af463d401c50d26f29b3b7a761af2e3/contract';
import endContract from '../../snapshots/eca743e012de8105f60878524fed22a18af463d401c50d26f29b3b7a761af2e3/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  lit,
  primaryKey,
  rawSql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'configuracion_reservas',
        columns: [
          col('id', 'int4', { notNull: true, default: lit(1), codecRef: { codecId: 'pg/int4@1' } }),
          col('pickupWaitMinutes', 'int4', {
            notNull: true,
            default: lit(30),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('weeklySchedule', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('configuracion_reservas_positive_revision_c2490804', 'version >= 1'),
          checkExpression('configuracion_reservas_singleton_check_7faf435e', 'id = 1'),
          checkExpression(
            'configuracion_reservas_wait_check_fb2a7262',
            '"pickupWaitMinutes" BETWEEN 1 AND 240',
          ),
        ],
      }),
      rawSql({
        id: 'data.configuracion_reservas.initial',
        label: 'Initialize reservation settings without inventing opening hours',
        operationClass: 'additive',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: 'configuracion_reservas' } },
        precheck: [{ description: 'Singleton is absent', sql: 'SELECT NOT EXISTS (SELECT 1 FROM public.configuracion_reservas WHERE id = 1) AS result' }],
        execute: [{ description: 'Initial persisted wait and unconfigured schedule', sql: 'INSERT INTO public.configuracion_reservas (id, "pickupWaitMinutes", "weeklySchedule", version, "updatedAt") VALUES (1, 30, NULL, 1, now()) ON CONFLICT (id) DO NOTHING' }],
        postcheck: [{ description: 'Singleton exists (preserve later ADMIN edits)', sql: 'SELECT EXISTS (SELECT 1 FROM public.configuracion_reservas WHERE id = 1) AS result' }],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
