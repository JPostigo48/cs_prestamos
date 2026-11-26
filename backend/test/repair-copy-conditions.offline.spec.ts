import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../prisma/contract.d.ts';
import contractJson from '../prisma/contract.json' with { type: 'json' };
import {
  nativeRepairDatabase,
  repairCopyConditions,
  type RepairDatabase,
} from '../prisma/seeds/repair-copy-conditions.seed.js';
import {
  repairOptions,
  runCopyRepair,
} from '../prisma/seeds/repair-copy-conditions.runner.js';

// Ninguna prueba carga archivos de entorno ni abre conexiones.
vi.mock('dotenv', () => ({
  config: vi.fn(() => {
    throw new Error('offline configuration stop');
  }),
}));
vi.mock('@prisma/orm-postgres/runtime', () => ({ default: vi.fn() }));
const { default: nativePostgres } = await vi.importActual<
  typeof import('@prisma/orm-postgres/runtime')
>('@prisma/orm-postgres/runtime');

interface Copy {
  condicionFisica: string | null;
  estado: string;
  habilitado: boolean;
  historial: string[];
}
const copy = (
  condicionFisica: string | null,
  estado = 'DISPONIBLE',
  habilitado = true,
): Copy => ({
  condicionFisica,
  estado,
  habilitado,
  historial: ['incidencia de prueba'],
});

/** Doble transaccional; no simula garantías de concurrencia PostgreSQL. */
function memory(initial: Copy[], fail = false) {
  let rows = structuredClone(initial);
  const update = vi.fn();
  const db: RepairDatabase = {
    async transaction(apply, work) {
      const draft = structuredClone(rows);
      const result = await work({
        counts: async () => ({
          total: draft.length,
          apto: draft.filter((row) => row.condicionFisica === 'APTO').length,
        }),
        setAllApto: async () => {
          if (!apply) throw new Error('write in preview');
          update();
          let count = 0;
          for (const row of draft) {
            if (row.condicionFisica !== 'APTO') {
              row.condicionFisica = 'APTO';
              count++;
            }
          }
          if (fail) throw new Error('write failed');
          return count;
        },
      });
      rows = draft;
      return result;
    },
  };
  return { db, rows: () => rows, update };
}

function nativeDouble(responses: unknown[][]) {
  // Solo construye planes con el builder real; nunca conecta.
  const builder = nativePostgres<Contract>({ contractJson });
  const query = vi.fn(async (_plan: unknown) => {
    const response = responses.shift();
    if (!response) throw new Error('unexpected query');
    return response;
  });
  const client = {
    raw: builder.raw,
    transaction: async (
      work: (tx: { query: typeof query }) => Promise<unknown>,
    ) => work({ query }),
    connect: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  return {
    client: client as unknown as Parameters<typeof nativeRepairDatabase>[0],
    query,
    connect: client.connect,
    close: client.close,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('correctivo ALL APTO offline', () => {
  it.each([
    null,
    'DANADO',
    'INCOMPLETO',
    'DANADO_E_INCOMPLETO',
    'PERDIDO',
    'ROBADO',
    'OTRA_ETIQUETA',
  ])('sobrescribe %s sin tocar otros campos', async (condition) => {
    const initial = [
      copy(condition),
      copy(condition, 'PRESTADO'),
      copy(condition, 'RESERVADO', false),
      copy(condition, 'NO_DISPONIBLE', false),
    ];
    const state = memory(initial);
    const result = await repairCopyConditions(state.db, { apply: true });
    expect(state.rows()).toEqual(
      initial.map((row) => ({ ...row, condicionFisica: 'APTO' })),
    );
    expect(result.summary).toEqual({
      total: 4,
      aptoBefore: 0,
      proposed: 0,
      updated: 4,
      aptoFinal: 4,
    });
  });

  it('preview no escribe y conserva todas las condiciones', async () => {
    const initial = [
      copy(null),
      copy('ROBADO', 'PRESTADO', false),
      copy('APTO'),
    ];
    const state = memory(initial);
    const result = await repairCopyConditions(state.db);
    expect(result).toEqual({
      mode: 'dry-run',
      summary: {
        total: 3,
        aptoBefore: 1,
        proposed: 2,
        updated: 0,
        aptoFinal: 1,
      },
    });
    expect(state.update).not.toHaveBeenCalled();
    expect(state.rows()).toEqual(initial);
  });

  it('APTO existente no cuenta como actualizado y repetir es idempotente', async () => {
    const state = memory([copy('APTO'), copy(null)]);
    expect(
      (await repairCopyConditions(state.db, { apply: true })).summary.updated,
    ).toBe(1);
    expect(
      (await repairCopyConditions(state.db, { apply: true })).summary,
    ).toEqual({
      total: 2,
      aptoBefore: 2,
      proposed: 0,
      updated: 0,
      aptoFinal: 2,
    });
  });

  it.each([false, true])('tabla vacía, apply=%s', async (apply) => {
    expect(
      (await repairCopyConditions(memory([]).db, { apply })).summary,
    ).toEqual({
      total: 0,
      aptoBefore: 0,
      proposed: 0,
      updated: 0,
      aptoFinal: 0,
    });
  });

  it('error revierte la transacción del doble', async () => {
    const initial = [copy(null), copy('DANADO')];
    const state = memory(initial, true);
    await expect(
      repairCopyConditions(state.db, { apply: true }),
    ).rejects.toThrow('write failed');
    expect(state.rows()).toEqual(initial);
  });

  it('contrato físico y actualización única sin filtros ni otras asignaciones', () => {
    const contract = readFileSync(
      new URL('../prisma/contract.prisma', import.meta.url),
      'utf8',
    );
    const model = /model Ejemplar\s*\{([\s\S]*?)\n\}/.exec(contract)![1];
    expect(model).toContain('@@map("ejemplares")');
    expect(model).toMatch(/condicionFisica\s+CondicionFisica\?\s*\n/);
    expect(contract).toMatch(/enum CondicionFisica\s*\{[^}]*\bAPTO\b/);
    const source = readFileSync(
      new URL(
        '../prisma/seeds/repair-copy-conditions.seed.ts',
        import.meta.url,
      ),
      'utf8',
    );
    const updates = source.match(/UPDATE[\s\S]*?RETURNING 1/g);
    expect(updates).toEqual([
      'UPDATE public.ejemplares SET "condicionFisica" = ${\'APTO\'}\n                  WHERE "condicionFisica" IS DISTINCT FROM ${\'APTO\'}\n                  RETURNING 1',
    ]);
  });

  it('planes nativos: un UPDATE masivo y conteos dentro de transacción', async () => {
    const fake = nativeDouble([
      [{ total: '8', apto: '1' }],
      [{ updated: '7' }],
      [{ total: '8', apto: '8' }],
    ]);
    expect(
      (
        await repairCopyConditions(nativeRepairDatabase(fake.client), {
          apply: true,
        })
      ).summary,
    ).toEqual({
      total: 8,
      aptoBefore: 1,
      proposed: 0,
      updated: 7,
      aptoFinal: 8,
    });
    expect(fake.query).toHaveBeenCalledTimes(3);
    expect(fake.connect).not.toHaveBeenCalled();
  });

  it('preview nativo configura solo lectura y solo cuenta', async () => {
    const fake = nativeDouble([[], [{ total: '2', apto: '0' }]]);
    expect(
      (await repairCopyConditions(nativeRepairDatabase(fake.client))).summary
        .updated,
    ).toBe(0);
    expect(fake.query).toHaveBeenCalledTimes(2);
  });

  it('CLI predeterminado preview; apply sin filtros parciales', () => {
    expect(repairOptions([])).toEqual({ apply: false });
    expect(repairOptions(['--dry-run'])).toEqual({ apply: false });
    expect(repairOptions(['--apply'])).toEqual({ apply: true });
    for (const args of [
      ['--apply', '--dry-run'],
      ['--reset'],
      ['--copy-id=00000000-0000-4000-8000-000000000001'],
      ['--apply', '--apply'],
    ])
      expect(() => repairOptions(args)).toThrow();
  });

  it('conserva alias raíz y script backend sin ejecutar la entrada', () => {
    const root = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    );
    const backend = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    );
    expect(root.scripts['seed:repair-copy-conditions']).toBe(
      'npm --prefix backend run seed:repair-copy-conditions --',
    );
    expect(backend.scripts['seed:repair-copy-conditions']).toBe(
      'tsx prisma/repair-copy-conditions.ts',
    );
  });

  it('carga habitual diferida, sin ejecutar dotenv real', async () => {
    expect(config).not.toHaveBeenCalled();
    await expect(runCopyRepair([])).rejects.toThrow(
      'offline configuration stop',
    );
    expect(config).toHaveBeenCalledExactlyOnceWith({ quiet: true });
    expect(postgres).not.toHaveBeenCalled();
  });

  it('rechaza argumentos antes del loader', async () => {
    const loader = vi.fn(async () => {});
    await expect(runCopyRepair(['--help'], loader)).rejects.toThrow();
    expect(loader).not.toHaveBeenCalled();
  });

  it('propaga --apply tras loader inyectado y cierra el cliente simulado', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const loader = vi.fn(async () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://offline.invalid/test');
    });
    const fake = nativeDouble([
      [{ total: '2', apto: '0' }],
      [{ updated: '2' }],
      [{ total: '2', apto: '2' }],
    ]);
    vi.mocked(postgres<Contract>).mockReturnValue(fake.client);
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = await runCopyRepair(['--apply'], loader);
    expect(loader).toHaveBeenCalledOnce();
    expect(result.mode).toBe('apply');
    expect(result.summary.updated).toBe(2);
    expect(fake.connect).toHaveBeenCalledOnce();
    expect(fake.close).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify(result, null, 2),
    );
    expect(log.mock.calls[0][0]).not.toContain('postgresql:');
  });

  it('cierra el cliente simulado ante error SQL y propaga el fallo', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://offline.invalid/test');
    const fake = nativeDouble([]);
    vi.mocked(postgres<Contract>).mockReturnValue(fake.client);
    await expect(runCopyRepair(['--apply'], async () => {})).rejects.toThrow(
      'unexpected query',
    );
    expect(fake.close).toHaveBeenCalledOnce();
  });
});
