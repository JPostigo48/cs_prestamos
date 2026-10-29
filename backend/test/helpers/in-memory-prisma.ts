import { randomUUID } from 'node:crypto';

type Row = Record<string, any>;
type Predicate = (row: Row) => boolean;
type Plan = {
  table: string;
  operation: string;
  data?: Row | Row[];
  predicates: Predicate[];
  limit?: number;
  offset?: number;
  count?: boolean;
  order?: { key: string; direction: string }[];
};

/** Doble del constructor SQL y transacciones; no crea clientes ni conexiones. */
export function inMemoryPrisma(initial: Record<string, Row[]> = {}) {
  let tables: Record<string, Row[]> = structuredClone(initial);
  const calls: Plan[] = [];
  let failAudit = false;
  const chain = (plan: Plan): any => ({
    where: (predicate: (row: Row, fns: any) => Predicate) =>
      chain({
        ...plan,
        predicates: [
          ...plan.predicates,
          predicate(new Proxy({}, { get: (_target, key) => key }), {
            eq: (key: string, value: unknown) => (row: Row) =>
              row[key] === value,
            ne: (key: string, value: unknown) => (row: Row) =>
              row[key] !== value,
            in: (key: string, values: unknown[]) => (row: Row) =>
              values.includes(row[key]),
            and:
              (...predicates: Predicate[]) =>
              (row: Row) =>
                predicates.every((p) => p(row)),
            lt: (key: string, value: any) => (row: Row) =>
              String(row[key]) < String(value),
            lte: (key: string, value: any) => (row: Row) =>
              String(row[key]) <= String(value),
            gte: (key: string, value: any) => (row: Row) =>
              String(row[key]) >= String(value),
            ilike: (key: string, value: string) => (row: Row) =>
              String(row[key])
                .toLowerCase()
                .includes(value.replaceAll('%', '').toLowerCase()),
          }),
        ],
      }),
    returning: () => chain(plan),
    orderBy: (key: (row: Row) => string, options: { direction: string }) =>
      chain({
        ...plan,
        order: [
          ...(plan.order ?? []),
          {
            key: key(new Proxy({}, { get: (_t, k) => k })),
            direction: options.direction,
          },
        ],
      }),
    limit: (limit: number) => chain({ ...plan, limit }),
    offset: (offset: number) => chain({ ...plan, offset }),
    build: () => plan,
  });
  const sql = {
    public: new Proxy(
      {},
      {
        get: (_target, table: string) => ({
          select: (...args: any[]) =>
            chain({
              table,
              operation: 'select',
              predicates: [],
              count: typeof args[0] === 'function',
            }),
          insert: (data: Row[]) =>
            chain({ table, operation: 'insert', data, predicates: [] }),
          update: (data: Row) =>
            chain({ table, operation: 'update', data, predicates: [] }),
          delete: () => chain({ table, operation: 'delete', predicates: [] }),
        }),
      },
    ),
  };
  const runtime = {
    query: async (plan: Plan) => {
      calls.push(plan);
      const rows = (tables[plan.table] ??= []);
      if (
        failAudit &&
        plan.table === 'auditorias_usuario' &&
        plan.operation === 'insert'
      )
        throw new Error('audit unavailable');
      const selected = rows.filter((row) =>
        plan.predicates.every((predicate) => predicate(row)),
      );
      if (plan.operation === 'select' && plan.count)
        return [{ total: selected.length }];
      if (plan.operation === 'select' && plan.order)
        selected.sort((a, b) => {
          for (const { key, direction } of plan.order!) {
            const comparison = String(a[key]).localeCompare(String(b[key]));
            if (comparison)
              return direction === 'desc' ? -comparison : comparison;
          }
          return 0;
        });
      if (plan.operation === 'select')
        return selected
          .slice(
            plan.offset ?? 0,
            plan.limit === undefined
              ? undefined
              : (plan.offset ?? 0) + plan.limit,
          )
          .map((row) => ({ ...row }));
      if (plan.operation === 'insert') {
        const inserted: Row[] = (plan.data as Row[]).map((data) => ({
          id: randomUUID(),
          ...(plan.table === 'solicitudes_registro'
            ? {
                estado: 'PENDIENTE',
                fechaSolicitud: new Date(),
                usuarioAprobadoId: null,
              }
            : {}),
          ...(plan.table === 'cuentas_acceso'
            ? { habilitada: true, ultimoAcceso: null }
            : {}),
          ...(plan.table === 'reservas'
            ? {
                fechaRecogida: null,
                fechaCancelacion: null,
                motivoCancelacion: null,
              }
            : {}),
          ...data,
        }));
        const unique =
          plan.table === 'usuarios'
            ? ['identificadorInstitucional']
            : plan.table === 'ejemplares'
              ? ['codigoInventario']
              : plan.table === 'categorias_recurso'
                ? ['nombre']
                : plan.table === 'inspecciones_devolucion' ||
                    plan.table === 'devoluciones'
                  ? ['prestamoId']
                  : plan.table === 'cuentas_acceso'
                    ? ['email', 'usuarioId']
                    : [];
        if (
          plan.table === 'accesorios_recurso' &&
          inserted.some((data) =>
            rows.some(
              (row) =>
                row.recursoId === data.recursoId &&
                row.nombreNormalizado === data.nombreNormalizado,
            ),
          )
        )
          throw Object.assign(new Error('duplicate accessory'), {
            code: '23505',
          });
        if (
          plan.table === 'solicitudes_registro' &&
          inserted.some((data) =>
            rows.some(
              (row) =>
                row.estado === 'PENDIENTE' &&
                data.estado === 'PENDIENTE' &&
                ((data.email != null && row.email === data.email) ||
                  (data.identificadorInstitucional != null &&
                    row.identificadorInstitucional ===
                      data.identificadorInstitucional)),
            ),
          )
        )
          throw Object.assign(new Error('duplicate pending request'), {
            code: '23505',
          });
        if (
          inserted.some((data) =>
            unique.some(
              (key) =>
                data[key] != null && rows.some((row) => row[key] === data[key]),
            ),
          )
        )
          throw Object.assign(new Error('duplicate'), { code: '23505' });
        rows.push(...inserted);
        return inserted.map((row) => ({ ...row }));
      }
      if (plan.operation === 'update') {
        const data = plan.data as Row;
        if (
          plan.table === 'accesorios_recurso' &&
          selected.some((item) => {
            const next = { ...item, ...data };
            return rows.some(
              (row) =>
                row.id !== next.id &&
                row.recursoId === next.recursoId &&
                row.nombreNormalizado === next.nombreNormalizado,
            );
          })
        )
          throw Object.assign(new Error('duplicate accessory'), {
            code: '23505',
          });
        const unique =
          plan.table === 'usuarios'
            ? ['identificadorInstitucional']
            : plan.table === 'ejemplares'
              ? ['codigoInventario']
              : plan.table === 'categorias_recurso'
                ? ['nombre']
                : [];
        if (
          selected.some((item) =>
            unique.some(
              (key) =>
                data[key] != null &&
                rows.some(
                  (row) => row.id !== item.id && row[key] === data[key],
                ),
            ),
          )
        )
          throw Object.assign(new Error('duplicate'), { code: '23505' });
        selected.forEach((row) => Object.assign(row, data));
      }
      if (plan.operation === 'delete')
        tables[plan.table] = rows.filter((row) => !selected.includes(row));
      return selected.map((row) => ({ ...row }));
    },
  };
  return {
    sql,
    client: {
      runtime: () => runtime,
      transaction: async (work: (tx: typeof runtime) => Promise<any>) => {
        // Copia superficial de filas: los instantes Temporal son inmutables.
        const previous = Object.fromEntries(
          Object.entries(tables).map(([table, rows]) => [
            table,
            rows.map((row) => ({ ...row })),
          ]),
        );
        try {
          return await work(runtime);
        } catch (error) {
          tables = previous;
          throw error;
        }
      },
    },
    rows: (table: string) => tables[table] ?? [],
    calls,
    failAudit: () => {
      failAudit = true;
    },
  };
}
