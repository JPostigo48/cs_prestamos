import type postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../contract.d.ts';

export class CopyRepairError extends Error {}

export interface RepairCounts {
  total: number;
  apto: number;
}
export interface RepairStore {
  counts(): Promise<RepairCounts>;
  setAllApto(): Promise<number>;
}
export interface RepairDatabase {
  transaction<T>(
    apply: boolean,
    work: (store: RepairStore) => Promise<T>,
  ): Promise<T>;
}

/** Solo datos de prueba: sobrescribe toda condición distinta de APTO, sin heurísticas. */
export async function repairCopyConditions(
  database: RepairDatabase,
  options: { apply?: boolean } = {},
) {
  const apply = options.apply === true;
  return database.transaction(apply, async (store) => {
    const before = await store.counts();
    const updated = apply ? await store.setAllApto() : 0;
    const after = apply ? await store.counts() : before;
    return {
      mode: apply ? 'apply' : 'dry-run',
      summary: {
        total: before.total,
        aptoBefore: before.apto,
        proposed: apply ? 0 : before.total - before.apto,
        updated,
        aptoFinal: after.apto,
      },
    };
  });
}

type NativeClient = ReturnType<typeof postgres<Contract>>;
export function nativeRepairDatabase(client: NativeClient): RepairDatabase {
  return {
    transaction: (apply, work) =>
      client.transaction(async (tx) => {
        if (!apply)
          await tx.query(
            client.raw
              .sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`
              .returnsRow({})
              .build(),
          );
        return work({
          counts: async () => {
            const [row] = await tx.query(
              client.raw.sql`
                SELECT count(*)::text AS total,
                  (count(*) FILTER (WHERE "condicionFisica" = ${'APTO'}))::text AS apto
                FROM public.ejemplares
              `
                .returnsRow({ total: 'pg/text@1', apto: 'pg/text@1' })
                .build(),
            );
            return { total: Number(row.total), apto: Number(row.apto) };
          },
          setAllApto: async () => {
            const [row] = await tx.query(
              client.raw.sql`
                WITH updated AS (
                  UPDATE public.ejemplares SET "condicionFisica" = ${'APTO'}
                  WHERE "condicionFisica" IS DISTINCT FROM ${'APTO'}
                  RETURNING 1
                )
                SELECT count(*)::text AS updated FROM updated
              `
                .returnsRow({ updated: 'pg/text@1' })
                .build(),
            );
            return Number(row.updated);
          },
        });
      }),
  };
}
