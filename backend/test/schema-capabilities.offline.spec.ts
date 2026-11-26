import { readFileSync } from 'node:fs';
import { episodeChecks } from './helpers/episode-checks.js';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../prisma/contract.d.ts';
import contractJson from '../prisma/contract.json' with { type: 'json' };
import {
  SchemaCapabilities,
  SchemaCapabilityUnavailableException,
  type KnownSchemaCapabilities,
  type SchemaCapabilityRuntime,
} from '../src/shared/infrastructure/prisma/schema-capabilities.js';
import {
  SCHEMA_COLUMNS,
  SCHEMA_ENUMS,
  SCHEMA_FOREIGN_KEYS,
  SCHEMA_UNIQUES,
} from '../src/shared/infrastructure/prisma/schema-capability-bundles.js';
import type {
  SchemaCapabilityClient,
  SchemaMetadata,
} from '../src/shared/infrastructure/prisma/schema-capability-metadata.js';

// Native builder only: never runtime(), connect(), dotenv, env or a database.
const native = postgres<Contract>({ contractJson });
type Constraint = SchemaMetadata['constraints'][number];
function constraint(input: Partial<Constraint>): Constraint {
  return {
    table: '',
    name: '',
    kind: 'c',
    columns: [],
    validated: true,
    deferred: false,
    expression: null,
    targetSchema: null,
    target: null,
    targetColumns: [],
    onDelete: ' ',
    onUpdate: ' ',
    ...input,
  };
}
function complete(): SchemaMetadata {
  return {
    tables: Object.keys(SCHEMA_COLUMNS),
    columns: Object.entries(SCHEMA_COLUMNS).flatMap(([table, columns]) =>
      Object.entries(columns).map(([name, spec]) => ({ table, name, ...spec })),
    ),
    constraints: [
      ...SCHEMA_ENUMS.map((e) =>
        constraint({
          table: e.table,
          name: `${e.table}_check`,
          columns: [e.column],
          expression: `("${e.column}" = ANY (ARRAY[${e.values.map((v) => `'${v}'::text`).join(', ')}]))`,
        }),
      ),
      ...SCHEMA_UNIQUES.map((u) =>
        constraint({
          table: u.table,
          name: u.name,
          kind: u.kind,
          columns: [...u.columns],
        }),
      ),
      ...SCHEMA_FOREIGN_KEYS.map((f) =>
        constraint({
          table: f.table,
          name: `${f.table}_${f.column}_fkey`,
          kind: 'f',
          columns: [f.column],
          targetSchema: 'public',
          target: f.target,
          targetColumns: ['id'],
          onDelete: 'r',
          onUpdate: 'c',
        }),
      ),
      ...episodeChecks(),
    ],
  };
}
const result = (data: SchemaMetadata) => [{ metadata: JSON.stringify(data) }];
function setup(initial = complete()) {
  let metadata = initial;
  let now = 0;
  const query = vi
    .fn()
    .mockImplementation(() => Promise.resolve(result(metadata)));
  const runtime = { query } as unknown as SchemaCapabilityRuntime;
  const factory = vi.fn(() => runtime);
  const client: SchemaCapabilityClient = { raw: native.raw, runtime: factory };
  const provider = new SchemaCapabilities(client, () => now);
  return {
    provider,
    query,
    factory,
    runtime,
    setMetadata: (value: SchemaMetadata) => {
      metadata = value;
    },
    setTime: (value: number) => {
      now = value;
    },
  };
}
async function known(
  provider: SchemaCapabilities,
): Promise<KnownSchemaCapabilities> {
  const snapshot = await provider.snapshot();
  expect(snapshot.status).toBe('known');
  if (snapshot.status !== 'known') throw new Error('Expected known metadata');
  return snapshot;
}

describe('schema capabilities: native PostgreSQL catalog plans, offline', () => {
  it.each([
    ['SCHEMA_INCOMPLETE', 'Operación bloqueada por una actualización pendiente del sistema. Solicite al administrador completar la actualización y vuelva a intentarlo.'],
    ['SCHEMA_UNKNOWN', 'No se pudo verificar la disponibilidad de esta operación. Vuelva a intentarlo; si persiste, contacte al administrador.'],
  ] as const)('serializes the exact safe HTTP contract: %s', async (diagnostic, message) => {
    const data = complete();
    data.tables = [];
    const { provider, query } = setup(data);
    if (diagnostic === 'SCHEMA_UNKNOWN')
      query.mockRejectedValueOnce(new Error('network: private provider details'));
    let failure: unknown;
    try {
      await provider.assert('loanClosure', 'loans.close');
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(SchemaCapabilityUnavailableException);
    const error = failure as SchemaCapabilityUnavailableException;
    expect(error.getStatus()).toBe(503);
    expect(JSON.stringify(error.getResponse())).toBe(JSON.stringify({
      statusCode: 503,
      code: 'SCHEMA_CAPABILITY_UNAVAILABLE',
      operation: 'loans.close',
      diagnostic,
      message,
    }));
  });

  it.each(episodeChecks().flatMap(check => ['missing', 'altered', 'unvalidated', 'wrong-table', 'wrong-kind'].map(change => ({ name: check.name, change }))))(
    'rejects independent episode CHECK $name: $change', async ({ name, change }) => {
      const data = complete();
      const check = data.constraints.find(c => c.name === name)!;
      if (change === 'missing') data.constraints = data.constraints.filter(c => c !== check);
      if (change === 'altered') check.expression += ' OR TRUE';
      if (change === 'unvalidated') check.validated = false;
      if (change === 'wrong-table') check.table = 'cierres_prestamo';
      if (change === 'wrong-kind') check.kind = 'u';
      const snapshot = await known(setup(data).provider);
      expect(snapshot.bundles.loanEpisodes).toBe(false);
      expect(snapshot.bundles.loanPolicyEpisodes).toBe(false);
      expect(snapshot.bundles.copyPhysicalState).toBe(true);
      expect(snapshot.bundles.loanClosure).toBe(true);
    },
  );

  it('recognizes independently deparsed CHECK definitions even when renamed', async () => {
    const data = complete();
    for (const check of data.constraints.filter(c => episodeChecks().some(e => e.name === c.name))) check.name = 'renamed';
    expect((await known(setup(data).provider)).bundles.loanEpisodes).toBe(true);
  });

  it.each([
    ['ajustes_efecto_check_bddadac4', 'SET_ZERO', 'SET_OTHER'],
    ['ajustes_efecto_check_bddadac4', '("duracionTotalDias" > 0)', '("duracionTotalDias" >= 0)'],
    ['ajustes_efecto_check_bddadac4', '("nominalObjetivo" IS NULL)', '("nominalObjetivo" IS NOT NULL)'],
    ['ajustes_saldos_check_2259aaf4', '(100)::numeric', '(101)::numeric'],
    ['ajustes_saldos_check_2259aaf4', '"saldoAnterior" - "saldoPosterior"', '"saldoPosterior" - "saldoAnterior"'],
    ['incumplimientos_episodio_contexto_check_431bd0a6', '("categoriaId" IS NOT NULL)', '("categoriaId" IS NULL)'],
    ['incumplimientos_episodio_contexto_check_431bd0a6', 'AND', 'OR'],
  ])('rejects changed semantics %s: %s', async (name, from, to) => {
    const data = complete();
    const check = data.constraints.find(c => c.name === name)!;
    expect(check.expression).toContain(from);
    check.expression = check.expression!.replace(from, to);
    expect((await known(setup(data).provider)).bundles.loanEpisodes).toBe(false);
  });

  it('all concrete migration tables/columns/FKs/uniques and enum CHECKs are represented', async () => {
    const { provider, query, factory } = setup();
    const snapshot = await known(provider);
    expect(Object.values(snapshot.capabilities).every(Boolean)).toBe(true);
    expect(snapshot.bundles).toEqual({
      copyPhysicalState: true,
      loanClosure: true,
      loanEpisodes: true,
      loanPolicyEpisodes: true,
    });
    expect(factory).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledOnce();
    const migration = readFileSync(
      new URL(
        '../prisma/migrations/app/20261125T0313_loan_policy_episodes/migration.ts',
        import.meta.url,
      ),
      'utf8',
    );
    for (const f of SCHEMA_FOREIGN_KEYS)
      expect(migration).toContain(`name: '${f.table}_${f.column}_fkey'`);
    for (const u of SCHEMA_UNIQUES.filter((u) => u.kind === 'u'))
      expect(migration).toContain(`constraint: '${u.name}'`);
    for (const [table, columns] of Object.entries(SCHEMA_COLUMNS)) {
      expect(migration).toContain(`table: '${table}'`);
      for (const name of Object.keys(columns)) {
        if (table !== 'prestamos')
          expect(migration).toContain(`col('${name}',`);
      }
    }
    const plan = query.mock.calls[0]![0];
    // Native raw builder yields bound ParamRefs, not interpolated identifiers/SQL.
    const serialized = JSON.stringify(plan);
    expect(serialized).toContain('pg_catalog.pg_class');
    expect(serialized).toContain('pg_catalog.pg_constraint');
    expect(serialized).toContain('pg_catalog.pg_attribute');
    expect(serialized).not.toMatch(
      /information_schema|_prisma_migrations|LOCK TABLE|CREATE TABLE/,
    );
    expect(
      plan.ast.parts.filter((part: unknown) => typeof part !== 'string'),
    ).toEqual([
      { kind: 'param-ref', value: 'public', codec: { codecId: 'pg/text@1' } },
      {
        kind: 'param-ref',
        value: JSON.stringify(Object.keys(SCHEMA_COLUMNS)),
        codec: { codecId: 'pg/text@1' },
      },
    ]);
    const sqlFragments = plan.ast.parts
      .filter((part: unknown) => typeof part === 'string')
      .join('');
    expect(sqlFragments).not.toContain('public');
    expect(sqlFragments).not.toContain('cierres_prestamo');
    expect(Object.isFrozen(snapshot.capabilities)).toBe(true);
  });

  it('partial columns remain individually usable even when their bundle is incomplete', async () => {
    const data = complete();
    data.columns = data.columns.filter(
      (c) => !(c.table === 'ejemplares' && c.name === 'habilitado'),
    );
    const { provider } = setup(data);
    const snapshot = await known(provider);
    expect(snapshot.capabilities['column:ejemplares.condicionFisica']).toBe(
      true,
    );
    expect(snapshot.capabilities['column:ejemplares.habilitado']).toBe(false);
    expect(snapshot.bundles.copyPhysicalState).toBe(false);
    expect(snapshot.bundles.loanEpisodes).toBe(true);
    await expect(
      provider.assert('copyPhysicalState', 'rehabilitateCopy'),
    ).rejects.toMatchObject({
      response: {
        statusCode: 503,
        code: 'SCHEMA_CAPABILITY_UNAVAILABLE',
        operation: 'rehabilitateCopy',
        diagnostic: 'SCHEMA_INCOMPLETE',
      },
    });
  });

  it.each(['type', 'nullable', 'table'] as const)(
    'rejects incompatible column %s',
    async (change) => {
      const data = complete();
      const column = data.columns.find((c) => c.name === 'habilitado')!;
      if (change === 'type') column.type = 'text';
      if (change === 'nullable') column.nullable = true;
      if (change === 'table')
        data.tables = data.tables.filter((t) => t !== 'ejemplares');
      expect(
        (await known(setup(data).provider)).capabilities[
          'column:ejemplares.habilitado'
        ],
      ).toBe(false);
    },
  );

  it.each([
    'missing',
    'unvalidated',
    'target',
    'schema',
    'column',
    'delete',
    'update',
    'deferred',
  ])('does not trust an incompatible FK: %s', async (change) => {
    const data = complete();
    const fk = data.constraints.find((c) => c.kind === 'f')!;
    const key = `foreignKey:${fk.name}`;
    if (change === 'missing')
      data.constraints = data.constraints.filter((c) => c !== fk);
    if (change === 'unvalidated') fk.validated = false;
    if (change === 'target') fk.target = 'usuarios';
    if (change === 'schema') fk.targetSchema = 'other';
    if (change === 'column') fk.targetColumns = ['otherId'];
    if (change === 'delete') fk.onDelete = 'c';
    if (change === 'update') fk.onUpdate = 'a';
    if (change === 'deferred') fk.deferred = true;
    expect((await known(setup(data).provider)).capabilities[key]).toBe(false);
  });

  it.each(['missing', 'wrong-columns', 'wrong-kind', 'deferred'])(
    'does not trust an incompatible unique: %s',
    async (change) => {
      const data = complete();
      const unique = data.constraints.find((c) => c.kind === 'u')!;
      const key = `unique:${unique.name}`;
      if (change === 'missing')
        data.constraints = data.constraints.filter((c) => c !== unique);
      if (change === 'wrong-columns') unique.columns.reverse();
      if (change === 'wrong-kind') unique.kind = 'c';
      if (change === 'deferred') unique.deferred = true;
      expect((await known(setup(data).provider)).capabilities[key]).toBe(false);
    },
  );

  it.each([
    'unvalidated',
    'missing-label',
    'negated',
    'wrong-column',
    'extra-label',
    'spaced-label',
  ])(
    'validates text enum CHECK semantics, not its name or label substrings: %s',
    async (change) => {
      const data = complete();
      const check = data.constraints[0]!;
      if (change === 'unvalidated') check.validated = false;
      if (change === 'missing-label')
        check.expression = check.expression!.replace(
          "'ROBADO'::text",
          "'OTRO'::text",
        );
      if (change === 'negated') check.expression = `NOT (${check.expression})`;
      if (change === 'wrong-column') check.columns = ['estado'];
      if (change === 'extra-label') check.expression += ' OR TRUE';
      if (change === 'spaced-label')
        check.expression = check.expression!.replace('APTO', 'AP TO');
      expect(
        (await known(setup(data).provider)).capabilities[
          'enum:ejemplares.condicionFisica'
        ],
      ).toBe(false);
    },
  );

  it('deduplicates concurrent inspection and expires positive and negative cache at exactly 30s', async () => {
    const h = setup({ tables: [], columns: [], constraints: [] });
    const snapshots = await Promise.all(
      Array.from({ length: 12 }, () => h.provider.snapshot()),
    );
    expect(h.query).toHaveBeenCalledOnce();
    expect(snapshots.every((s) => s === snapshots[0])).toBe(true);
    h.setMetadata(complete());
    h.setTime(29_999);
    expect((await known(h.provider)).bundles.loanPolicyEpisodes).toBe(false);
    h.setTime(30_000);
    expect((await known(h.provider)).bundles.loanPolicyEpisodes).toBe(true);
    h.setMetadata({ tables: [], columns: [], constraints: [] });
    h.setTime(60_000);
    expect((await known(h.provider)).bundles.loanPolicyEpisodes).toBe(false);
    expect(h.query).toHaveBeenCalledTimes(3);
  });

  it('invalidation cannot let an older in-flight inspection overwrite newer metadata', async () => {
    const h = setup();
    let resolve!: (value: ReturnType<typeof result>) => void;
    h.query.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const older = h.provider.snapshot();
    h.provider.invalidate();
    expect((await known(h.provider)).bundles.loanPolicyEpisodes).toBe(true);
    resolve(result({ tables: [], columns: [], constraints: [] }));
    await older;
    expect((await known(h.provider)).bundles.loanPolicyEpisodes).toBe(true);
    expect(h.query).toHaveBeenCalledTimes(2);
  });

  it.each(['ECONNRESET', '42501', '42601', '42703', '42P01'])(
    'metadata failure %s is unknown, safe and never cached as missing',
    async (code) => {
      const h = setup();
      h.query.mockRejectedValueOnce({
        code,
        message: 'secret SQL connection details',
      });
      const snapshot = await h.provider.snapshot();
      expect(snapshot).toEqual({
        status: 'unknown',
        checkedAt: 0,
        diagnostic: 'METADATA_UNAVAILABLE',
      });
      expect(JSON.stringify(snapshot)).not.toContain('secret');
      expect((await known(h.provider)).bundles.loanPolicyEpisodes).toBe(true);
      h.provider.invalidate();
      h.query.mockRejectedValueOnce({ code, message: 'secret' });
      await expect(
        h.provider.assert('loanEpisodes', 'synchronizeEpisodes'),
      ).rejects.toMatchObject({
        response: {
          statusCode: 503,
          code: 'SCHEMA_CAPABILITY_UNAVAILABLE',
          diagnostic: 'SCHEMA_UNKNOWN',
          operation: 'synchronizeEpisodes',
        },
      });
    },
  );

  it.each([
    [],
    [{ metadata: '{}' }],
    [{ metadata: 'not json' }],
    [
      {
        metadata: JSON.stringify({
          tables: [],
          columns: [{}],
          constraints: [],
        }),
      },
    ],
  ])('malformed catalog response remains unknown', async (...rows) => {
    const h = setup();
    h.query.mockResolvedValueOnce(rows);
    expect((await h.provider.snapshot()).status).toBe('unknown');
  });

  it('explicit runtime revalidates every time and never leaks transaction metadata into shared cache', async () => {
    const h = setup();
    await h.provider.assert('loanPolicyEpisodes', 'beforeTransaction');
    const query = vi
      .fn()
      .mockResolvedValue(result({ tables: [], columns: [], constraints: [] }));
    const tx = { query } as unknown as SchemaCapabilityRuntime;
    await expect(
      h.provider.assert('loanPolicyEpisodes', 'write', tx),
    ).rejects.toBeInstanceOf(SchemaCapabilityUnavailableException);
    await expect(
      h.provider.assert('loanPolicyEpisodes', 'write', tx),
    ).rejects.toBeInstanceOf(SchemaCapabilityUnavailableException);
    expect(query).toHaveBeenCalledTimes(2);
    expect((await known(h.provider)).bundles.loanPolicyEpisodes).toBe(true);
    expect(h.query).toHaveBeenCalledOnce();
  });

  it.each(['42703', '42P01'])(
    'post-rollback classification preserves the original %s with complete required bundles',
    async (code) => {
      const h = setup();
      await known(h.provider);
      const data = complete();
      data.tables = data.tables.filter(table => table !== 'cierres_prestamo');
      h.setMetadata(data);
      const error = { cause: { sqlState: code } };
      await expect(h.provider.rethrowAfterRollback(
        error, ['copyPhysicalState', 'loanEpisodes'], 'test.write',
      )).rejects.toBe(error);
      expect(h.query).toHaveBeenCalledTimes(2);
      expect((await known(h.provider)).bundles.loanClosure).toBe(false);
      expect(h.query).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['42703', '42P01'])(
    'post-rollback classification confirms missing required bundles after %s',
    async (code) => {
      const h = setup();
      await known(h.provider);
      const data = complete();
      data.tables = data.tables.filter(table => table !== 'cierres_prestamo');
      h.setMetadata(data);
      await expect(h.provider.rethrowAfterRollback(
        { code }, ['copyPhysicalState', 'loanClosure'], 'test.write',
      )).rejects.toMatchObject({ response: {
        statusCode: 503, operation: 'test.write', diagnostic: 'SCHEMA_INCOMPLETE',
      } });
      expect(h.query).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['42501', 'ECONNRESET', '42601', '42703', '42P01'])(
    'post-rollback metadata failure %s is safe unknown and not cached',
    async code => {
      const h = setup();
      await known(h.provider);
      h.query.mockRejectedValueOnce({ code, message: 'private SQL/URL/value' });
      const failure = h.provider.rethrowAfterRollback(
        { code: '42703' }, ['loanEpisodes'], 'test.write',
      );
      await expect(failure).rejects.toMatchObject({ response: {
        statusCode: 503, operation: 'test.write', diagnostic: 'SCHEMA_UNKNOWN',
      } });
      await failure.catch(error => {
        expect(JSON.stringify(error.getResponse())).not.toContain('private');
      });
      expect((await known(h.provider)).bundles.loanEpisodes).toBe(true);
      expect(h.query).toHaveBeenCalledTimes(3);
    },
  );

  it.each(['42501', 'ECONNRESET', '42601', '23505', '25P02'])(
    'post-rollback non-structural error %s preserves cache and identity',
    async code => {
      const h = setup();
      const cached = await known(h.provider);
      const error = { code };
      await expect(h.provider.rethrowAfterRollback(
        error, ['loanEpisodes'], 'test.write',
      )).rejects.toBe(error);
      expect(await h.provider.snapshot()).toBe(cached);
      expect(h.query).toHaveBeenCalledOnce();
    },
  );

  it('read uses confirmed partial capabilities and recovers hot after explicit invalidation', async () => {
    const h = setup({ tables: [], columns: [], constraints: [] });
    const primary = vi.fn().mockResolvedValue('new');
    const fallback = vi.fn().mockResolvedValue('old');
    expect(
      await h.provider.read(
        'copyPhysicalState',
        'listCopies',
        primary,
        fallback,
      ),
    ).toBe('old');
    expect(
      fallback.mock.calls[0]![0].capabilities['column:ejemplares.habilitado'],
    ).toBe(false);
    h.setMetadata(complete());
    h.provider.invalidate();
    expect(
      await h.provider.read(
        'copyPhysicalState',
        'listCopies',
        primary,
        fallback,
      ),
    ).toBe('new');
  });

  it.each(['42703', '42P01'])(
    'read invalidates and verifies before fallback after %s',
    async (code) => {
      const h = setup();
      const primary = vi.fn().mockImplementation(async () => {
        h.setMetadata({ tables: [], columns: [], constraints: [] });
        throw { cause: { code } };
      });
      const fallback = vi.fn().mockImplementation(async () => {
        expect(h.query).toHaveBeenCalledTimes(2);
        return 'legacy';
      });
      expect(
        await h.provider.read('loanClosure', 'history', primary, fallback),
      ).toBe('legacy');
      expect(primary).toHaveBeenCalledOnce();
      expect(fallback).toHaveBeenCalledOnce();
    },
  );

  it('complete metadata retries primary only once, never hides SQL defects as fallback', async () => {
    const h = setup();
    const error = { code: '42703' };
    const primary = vi.fn().mockRejectedValue(error);
    const fallback = vi.fn();
    await expect(
      h.provider.read('loanClosure', 'history', primary, fallback),
    ).rejects.toBe(error);
    expect(primary).toHaveBeenCalledTimes(2);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('native sqlState envelopes retry successfully without entering fallback', async () => {
    const h = setup();
    const primary = vi
      .fn()
      .mockRejectedValueOnce({ sqlState: '42703' })
      .mockResolvedValue('recovered');
    const fallback = vi.fn();
    expect(
      await h.provider.read('loanClosure', 'history', primary, fallback),
    ).toBe('recovered');
    expect(primary).toHaveBeenCalledTimes(2);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('a cyclic unknown error cause is propagated without retry', async () => {
    const h = setup();
    const error: { cause?: unknown } = {};
    error.cause = error;
    const primary = vi.fn().mockRejectedValue(error),
      fallback = vi.fn();
    await expect(
      h.provider.read('loanClosure', 'history', primary, fallback),
    ).rejects.toBe(error);
    expect(primary).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
  });

  it.each(['ECONNRESET', '42501', '42601', '23505'])(
    'read never retries or falls back on %s',
    async (code) => {
      const h = setup();
      const error = { code };
      const primary = vi.fn().mockRejectedValue(error),
        fallback = vi.fn();
      await expect(
        h.provider.read('loanClosure', 'history', primary, fallback),
      ).rejects.toBe(error);
      expect(primary).toHaveBeenCalledOnce();
      expect(fallback).not.toHaveBeenCalled();
      expect(h.query).toHaveBeenCalledOnce();
    },
  );

  it('unknown initial metadata or unknown revalidation never enables fallback', async () => {
    const h = setup();
    const primary = vi.fn().mockImplementation(async () => {
      h.query.mockRejectedValueOnce({ code: '42501' });
      throw { code: '42P01' };
    });
    const fallback = vi.fn();
    await expect(
      h.provider.read('loanClosure', 'history', primary, fallback),
    ).rejects.toMatchObject({ response: { diagnostic: 'SCHEMA_UNKNOWN' } });
    h.query.mockRejectedValueOnce(new Error('network'));
    await expect(
      h.provider.read('loanClosure', 'history', primary, fallback),
    ).rejects.toMatchObject({ response: { diagnostic: 'SCHEMA_UNKNOWN' } });
    expect(primary).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
  });
});
