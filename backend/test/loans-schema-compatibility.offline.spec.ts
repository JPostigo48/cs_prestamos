import 'reflect-metadata';
import 'temporal-polyfill/full/global';
import { Temporal } from 'temporal-polyfill/full';
import postgres from '@prisma/orm-postgres/runtime';
import { Logger } from '@nestjs/common';
import type { Contract } from '../prisma/contract.d.ts';
import contractJson from '../prisma/contract.json' with { type: 'json' };
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import type { SchemaMetadata } from '../src/shared/infrastructure/prisma/schema-capability-metadata.js';
import { SchemaCapabilities, SchemaCapabilityUnavailableException } from '../src/shared/infrastructure/prisma/schema-capabilities.js';
import { SCHEMA_COLUMNS } from '../src/shared/infrastructure/prisma/schema-capability-bundles.js';
import { PrismaLoanRepository } from '../src/modules/loans/infrastructure/persistence/prisma/prisma-loan.repository.js';
import { PrismaReservationRepository } from '../src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.js';
import { PrismaSanctionRepository } from '../src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.js';
import { PrismaViolationRepository } from '../src/modules/rules/infrastructure/persistence/prisma/prisma-violation.repository.js';
import { PrismaAppealRepository } from '../src/modules/rules/infrastructure/persistence/prisma/prisma-appeal.repository.js';
import { LoanOverdueSynchronizer } from '../src/modules/loans/infrastructure/loan-overdue-synchronizer.js';
import { LoanOverdueService } from '../src/modules/loans/infrastructure/loan-overdue.service.js';
import { ReservationExpiryService } from '../src/modules/loans/infrastructure/reservation-expiry.service.js';
import { LoanJobMonitor } from '../src/modules/loans/infrastructure/loan-job-monitor.js';
import { loanSchemaTransaction, SANCTION_OPERATION_SCHEMA, loanFailureDiagnostic } from '../src/modules/loans/infrastructure/loan-schema.js';
import { completeLoanSchema } from './helpers/loan-schema.js';
import { episodeChecks } from './helpers/episode-checks.js';

// No environment files, connections, services or production Prisma instance.
vi.mock('dotenv/config', () => ({}));
const native = postgres<Contract>({ contractJson });
type Node = Record<string, any>;
const sqlError = (code: string) => Object.assign(new Error('private SQL/URL/value must not leak'), { code });
const oldSchema = (): SchemaMetadata => ({ tables: ['prestamos', 'ejemplares', 'incumplimientos'], columns: [], constraints: [] });

/** Native SQL AST double. Absent objects fail even in predicates/returning.
 * Not a simulation of PostgreSQL DDL locks or isolation. */
function fixture(initial = completeLoanSchema()) {
  let metadata = initial;
  let metadataError: unknown;
  let readError: unknown;
  let beforeRead: (() => void) | undefined;
  let beforeTransaction: (() => void) | undefined;
  let committedWrites = 0;
  let rollbacks = 0;
  const calls: Node[] = [];
  const writes: Node[] = [];
  const at = Temporal.Instant.from('2026-11-24T12:00:00Z');
  const rows: Record<string, Node[]> = {
    recursos: [{ id: 'resource' }], ejemplares: [{ id: 'copy', recursoId: 'resource' }],
    prestamos: [{ id: 'loan', usuarioId: 'user', ejemplarId: 'copy', estado: 'ACTIVO', fechaInicio: at, fechaFin: at, configurationSnapshot: null }],
    devoluciones: [], inspecciones_devolucion: [], cierres_prestamo: [],
    sanciones: [], incumplimientos: [], ajustes_incumplimiento: [],
  };
  const checkColumn = (table: string, name: string) => {
    const tracked = SCHEMA_COLUMNS[table as keyof typeof SCHEMA_COLUMNS];
    if (tracked && Object.hasOwn(tracked, name) && !metadata.columns.some(c => c.table === table && c.name === name))
      throw sqlError('42703');
  };
  const validate = (node: unknown, table: string): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Node;
    if (n.kind === 'identifier-ref') checkColumn(table, n.name);
    if (n.kind === 'column-ref') checkColumn(n.table ?? table, n.column);
    if (n.kind === 'table-source' && Object.hasOwn(SCHEMA_COLUMNS, n.name) && !metadata.tables.includes(n.name))
      throw sqlError('42P01');
    for (const part of Object.values(n)) validate(part, table);
  };
  const value = (node: Node, row: Node): any => {
    if (node.kind === 'identifier-ref') return row[node.name];
    if (node.kind === 'column-ref') return row[node.column];
    if (node.kind === 'param-ref' || node.kind === 'literal') return node.value;
    if (node.kind === 'list') return node.values.map((p: Node) => value(p, row));
    if (node.kind === 'and') return node.exprs.every((p: Node) => value(p, row));
    if (node.kind === 'binary') {
      const left = value(node.left, row), right = value(node.right, row);
      if (node.op === 'eq') return left === right;
      if (node.op === 'in') return right.includes(left);
      if (node.op === 'lt') return String(left) < String(right);
      if (node.op === 'gt') return String(left) > String(right);
    }
    if (node.kind === 'in') return node.values.some((p: Node) => value(p, row) === value(node.expr, row));
    throw new Error(`Unsupported AST expression ${node.kind}/${node.op}`);
  };
  const query = vi.fn(async (plan: Node) => {
    const ast = plan.ast;
    if (Array.isArray(ast.parts)) {
      const text = ast.parts.filter((p: unknown) => typeof p === 'string').join('');
      if (text.includes('pg_catalog.pg_class')) {
        if (metadataError) throw metadataError;
        return [{ metadata: JSON.stringify(metadata) }];
      }
      throw new Error('Unexpected raw SQL');
    }
    calls.push(ast);
    if (ast.kind === 'select') {
      const callback = beforeRead; beforeRead = undefined; callback?.();
      if (readError) { const error = readError; readError = undefined; throw error; }
    }
    const table = (ast.from ?? ast.table).name;
    validate(ast, table);
    for (const name of Object.keys(ast.set ?? {})) checkColumn(table, name);
    for (const row of ast.rows ?? []) for (const name of Object.keys(row)) checkColumn(table, name);
    if (ast.kind !== 'select') { writes.push(ast); committedWrites++; return []; }
    const selected = (rows[table] ?? []).filter(row => !ast.where || value(ast.where, row));
    if (ast.projection.some((p: Node) => p.alias === 'total')) return [{ total: selected.length }];
    return selected.map(row => Object.fromEntries(ast.projection.map((p: Node) => [p.alias, value(p.expr, row)])));
  });
  const runtime = { query };
  const client = {
    raw: native.raw, runtime: () => runtime,
    transaction: vi.fn(async (work: (tx: typeof runtime) => Promise<unknown>) => {
      beforeTransaction?.();
      const previous = committedWrites;
      try { return await work(runtime); }
      catch (error) { committedWrites = previous; rollbacks++; throw error; }
    }),
  };
  const provider = new SchemaCapabilities(client as never);
  const prisma = { sql: native.sql, client, schemaCapabilities: provider } as unknown as PrismaService;
  return {
    prisma, provider, runtime, query, calls, writes, rows, client,
    setSchema: (next: SchemaMetadata) => { metadata = next; },
    failMetadata: (error: unknown) => { metadataError = error; },
    failRead: (error: unknown) => { readError = error; },
    onRead: (callback: () => void) => { beforeRead = callback; },
    onTransaction: (callback: () => void) => { beforeTransaction = callback; },
    committed: () => committedWrites, rollbacks: () => rollbacks,
    loans: new PrismaLoanRepository(prisma), reservations: new PrismaReservationRepository(prisma),
    sanctions: new PrismaSanctionRepository(prisma), violations: new PrismaViolationRepository(prisma),
    appeals: new PrismaAppealRepository(prisma), overdue: new LoanOverdueSynchronizer(prisma),
  };
}

async function unavailable(work: Promise<unknown>) {
  await expect(work).rejects.toMatchObject({
    response: { statusCode: 503, code: 'SCHEMA_CAPABILITY_UNAVAILABLE' },
  });
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('loans/rules physical schema compatibility offline', () => {
  it.each(episodeChecks().flatMap(check => ['missing', 'altered', 'unvalidated'].map(change => ({ name: check.name, change }))))(
    '$name $change blocks guarded writes before transaction', async ({ name, change }) => {
      const schema = completeLoanSchema();
      const check = schema.constraints.find(c => c.name === name)!;
      if (change === 'missing') schema.constraints = schema.constraints.filter(c => c !== check);
      if (change === 'altered') check.expression = 'TRUE';
      if (change === 'unvalidated') check.validated = false;
      const f = fixture(schema);
      for (const work of [
        () => f.reservations.create({ userId: 'user' } as never),
        () => f.reservations.pickup('reservation', new Date()),
        () => f.reservations.cancel({ reservationId: 'reservation' } as never),
        () => f.reservations.expire(new Date()),
        () => f.loans.closeLoan({} as never),
        () => f.sanctions.suspend({} as never),
        () => f.sanctions.lift('sanction', 'reason', {} as never),
        () => f.violations.createWithPenalty({} as never),
        () => f.appeals.create({} as never),
        () => f.appeals.resolve({} as never),
        () => f.overdue.synchronizeUser('user'),
        () => f.overdue.synchronizeLoan('user', 'loan'),
      ]) await unavailable(work());
      expect(f.writes).toHaveLength(0);
      expect(f.client.transaction).not.toHaveBeenCalled();
    },
  );

  it('the double rejects absent table/SELECT/WHERE/RETURNING/write columns', async () => {
    const f = fixture(oldSchema());
    for (const plan of [
      native.sql.public.cierres_prestamo.select('resultado').build(),
      native.sql.public.incumplimientos.select('origen').build(),
      native.sql.public.incumplimientos.select('id').where((r, q) => q.eq(r.prestamoId, 'loan')).build(),
      native.sql.public.incumplimientos.update({ id: 'x' }).returning('categoriaId').build(),
      native.sql.public.ejemplares.update({ habilitado: true }).build(),
    ]) await expect(f.runtime.query(plan as never)).rejects.toHaveProperty('code');
    expect(f.writes).toHaveLength(0);
  });

  it.each(['findById', 'findActive', 'findByUserId', 'findOverdue'] as const)('legacy %s does not query absent closures', async (method) => {
    const schema = oldSchema();
    schema.columns = completeLoanSchema().columns.filter(c => c.table === 'prestamos');
    const f = fixture(schema);
    const result = await (f.loans[method] as (arg: any) => Promise<any>)(method === 'findOverdue' ? new Date() : method === 'findByUserId' ? 'user' : 'loan');
    const loan = Array.isArray(result) ? result[0] : result;
    expect(loan).toMatchObject({ closure: null, closureHistory: 'UNAVAILABLE' });
    expect(f.calls.some(c => c.from.name === 'cierres_prestamo')).toBe(false);
    expect(f.writes).toHaveLength(0);
  });

  it('unknown metadata is 503, never a fabricated absent closure', async () => {
    const f = fixture(); f.failMetadata(sqlError('42501'));
    await unavailable(f.loans.findById('loan'));
    expect(f.calls.some(c => c.from.name === 'cierres_prestamo')).toBe(false);
  });

  it('partial schema reads closure results without unrelated columns/constraints', async () => {
    const schema = completeLoanSchema();
    schema.constraints = [];
    schema.columns = schema.columns.filter(c => c.table !== 'cierres_prestamo' || ['prestamoId', 'resultado'].includes(c.name));
    const f = fixture(schema);
    expect(await f.loans.findById('loan')).toMatchObject({ closureHistory: 'AVAILABLE', closure: null });
    expect(f.calls.some(c => c.from.name === 'cierres_prestamo')).toBe(true);
  });

  it('partial missing result avoids the closure table entirely', async () => {
    const schema = completeLoanSchema();
    schema.columns = schema.columns.filter(c => c.table !== 'cierres_prestamo' || c.name !== 'resultado');
    const f = fixture(schema);
    expect(await f.loans.findById('loan')).toMatchObject({ closureHistory: 'UNAVAILABLE' });
    expect(f.calls.some(c => c.from.name === 'cierres_prestamo')).toBe(false);
  });

  it('full schema restores the original closure result, not a basic projection', async () => {
    const f = fixture();
    const original = {
      id: 'loan', startsAt: '2026-11-24T12:00:00Z', endsAt: '2026-11-24T12:00:00Z',
      closure: { id: 'closure', requestId: 'request' },
      consequences: [{ violationId: 'episode', effectivePenaltyTotal: 7 }],
      reward: { effectivePoints: 0 }, status: 'FINALIZADO', return: null,
    };
    f.rows.cierres_prestamo!.push({ prestamoId: 'loan', resultado: original });
    const restored = await f.loans.findById('loan');
    expect(restored).toMatchObject({ ...original, startsAt: expect.any(Date), endsAt: expect.any(Date), closureHistory: 'AVAILABLE' });
    expect(f.calls.some(c => c.from.name === 'devoluciones')).toBe(false);
  });

  it('resource history keeps legacy pagination without querying absent closures', async () => {
    const schema = oldSchema();
    schema.columns = completeLoanSchema().columns.filter(c => c.table === 'prestamos');
    const f = fixture(schema);
    const page = await f.loans.findResourceHistory('resource', { page: 1, limit: 20 });
    expect(page).toMatchObject({ total: 1, page: 1, limit: 20, items: [{ id: 'loan', closureHistory: 'UNAVAILABLE' }] });
    expect(f.calls.some(c => c.from.name === 'cierres_prestamo')).toBe(false);
  });

  it('rules detail reads actual adjustment columns even without unrelated constraints', async () => {
    const schema = completeLoanSchema(); schema.constraints = [];
    const f = fixture(schema);
    f.rows.sanciones!.push({
      id: 'sanction', usuarioId: 'user', incumplimientoId: 'episode', reglaId: null,
      versionReglaId: null, estado: 'FINALIZADA', fechaInicio: Temporal.Now.instant(),
      fechaFin: Temporal.Now.instant(), confianzaAnterior: '100', confianzaPosterior: '90',
    });
    expect(await f.sanctions.findDetail('sanction')).toMatchObject({ id: 'sanction', current: null });
    expect(f.calls.some(c => c.from.name === 'ajustes_incumplimiento')).toBe(true);
    schema.columns = schema.columns.filter(c => c.table !== 'ajustes_incumplimiento' || c.name !== 'descuentoEfectivo');
    f.provider.invalidate(); f.calls.length = 0;
    await unavailable(f.sanctions.findDetail('sanction'));
    expect(f.calls).toHaveLength(0);
  });

  it('cached closure schema is invalidated after SQLSTATE and read restarts outside a transaction', async () => {
    const f = fixture(); await f.provider.snapshot();
    // Keep legacy loan estado readable; only the closure disappears.
    const old = oldSchema(); old.columns = completeLoanSchema().columns.filter(c => c.table === 'prestamos');
    f.onRead(() => f.setSchema(old));
    expect(await f.loans.findById('loan')).toMatchObject({ closureHistory: 'UNAVAILABLE' });
    expect(f.client.transaction).not.toHaveBeenCalled();
  });

  it.each(['42501', 'ECONNRESET', '42601'])('unrelated read %s is not schema fallback', async code => {
    const f = fixture(); f.failRead(sqlError(code));
    await expect(f.loans.findById('loan')).rejects.toHaveProperty('code', code);
  });

  it('rules detail and return policy fail before absent adjustment/episode queries', async () => {
    const f = fixture(oldSchema());
    await unavailable(f.sanctions.findDetail('sanction'));
    await unavailable(f.loans.readReturnPolicy('loan'));
    expect(f.calls).toHaveLength(0);
  });

  it.each(['old', 'partial', 'unknown'] as const)('%s blocks every guarded entry before any write', async mode => {
    const schema = mode === 'old' ? oldSchema() : completeLoanSchema();
    if (mode === 'partial') schema.constraints = [];
    const f = fixture(schema);
    if (mode === 'unknown') f.failMetadata(sqlError('ECONNRESET'));
    const operations = [
      () => f.reservations.create({ userId: 'user' } as never),
      () => f.reservations.pickup('reservation', new Date()),
      () => f.reservations.cancel({ reservationId: 'reservation' } as never),
      () => f.reservations.expire(new Date()),
      () => f.loans.closeLoan({} as never),
      () => f.sanctions.suspend({} as never),
      () => f.sanctions.lift('sanction', 'reason', {} as never),
      () => f.violations.createWithPenalty({} as never),
      () => f.appeals.create({} as never),
      () => f.appeals.resolve({} as never),
      () => f.overdue.synchronizeUser('user'),
      () => f.overdue.synchronizeLoan('user', 'loan'),
    ];
    for (const work of operations) await unavailable(work());
    expect(f.writes).toHaveLength(0);
    expect(f.client.transaction).not.toHaveBeenCalled();
  });

  it('revalidates inside tx before even a neutral locking update', async () => {
    const f = fixture();
    f.onTransaction(() => f.setSchema(oldSchema()));
    await unavailable(f.reservations.cancel({ reservationId: 'reservation' } as never));
    expect(f.rollbacks()).toBe(1);
    expect(f.writes).toHaveLength(0);
  });

  it.each(episodeChecks().map(check => check.name))('revalidates altered CHECK %s inside tx with zero writes', async name => {
    const f = fixture();
    const changed = completeLoanSchema();
    changed.constraints.find(c => c.name === name)!.expression += ' OR TRUE';
    f.onTransaction(() => f.setSchema(changed));
    await unavailable(f.reservations.cancel({ reservationId: 'reservation' } as never));
    expect(f.rollbacks()).toBe(1);
    expect(f.writes).toHaveLength(0);
  });

  it('closure idempotency read races also return 503 before any write', async () => {
    const f = fixture(); await f.provider.snapshot();
    f.onRead(() => f.setSchema(oldSchema()));
    await unavailable(f.loans.closeLoan({
      loanId: 'loan', requestId: 'request', kind: 'PERDIDA', confirmed: true,
      description: 'loss', evidenceIds: [], actor: { userId: 'user', accountId: 'account' },
    } as never));
    expect(f.client.transaction).not.toHaveBeenCalled();
    expect(f.writes).toHaveLength(0);
  });

  it('write SQLSTATE rolls back once, never falls back or retries writes', async () => {
    const f = fixture();
    await unavailable(loanSchemaTransaction(f.prisma, SANCTION_OPERATION_SCHEMA, 'test.write', async tx => {
      await tx.query(native.sql.public.prestamos.update({ id: 'loan' }).build());
      f.setSchema(oldSchema());
      throw sqlError('42703');
    }));
    expect(f.writes).toHaveLength(1);
    expect(f.committed()).toBe(0);
    expect(f.rollbacks()).toBe(1);
    expect(f.client.transaction).toHaveBeenCalledTimes(1);
  });

  it.each(['42703', '42P01'].flatMap(code =>
    ['complete', 'missing', 'unknown'].map(metadata => ({ code, metadata })),
  ))('revalidates $code/$metadata only after rollback outside the aborted runtime', async ({ code, metadata }) => {
    const f = fixture();
    let inTransaction = false;
    let aborted = false;
    const txQuery = vi.fn(async (plan: Parameters<typeof f.runtime.query>[0]) => {
      if (aborted) throw sqlError('25P02');
      return f.runtime.query(plan);
    });
    f.client.transaction.mockImplementationOnce(async work => {
      inTransaction = true;
      try { return await work({ query: txQuery }); }
      finally { aborted = true; inTransaction = false; }
    });
    const snapshot = vi.spyOn(f.provider, 'snapshot');
    const runtime = vi.spyOn(f.client, 'runtime').mockImplementation(() => {
      expect(inTransaction).toBe(false);
      return f.runtime;
    });
    const original = { cause: { sqlState: code, message: 'private SQL/URL/value' } };
    const work = vi.fn(async () => {
      if (metadata === 'missing') f.setSchema(oldSchema());
      if (metadata === 'unknown') f.failMetadata(sqlError('42501'));
      throw original;
    });
    const result = loanSchemaTransaction(f.prisma, SANCTION_OPERATION_SCHEMA, 'test.write', work);
    if (metadata === 'complete') await expect(result).rejects.toBe(original);
    else await expect(result).rejects.toMatchObject({ response: {
      statusCode: 503, operation: 'test.write',
      diagnostic: metadata === 'missing' ? 'SCHEMA_INCOMPLETE' : 'SCHEMA_UNKNOWN',
    } });
    expect(aborted).toBe(true);
    expect(work).toHaveBeenCalledOnce();
    expect(f.client.transaction).toHaveBeenCalledOnce();
    expect(txQuery).toHaveBeenCalledTimes(2); // One preflight per bundle, never aborted metadata.
    expect(runtime).toHaveBeenCalledTimes(2); // External preflight and post-rollback.
    expect(snapshot.mock.calls.map(args => args[0])).toEqual([
      undefined, undefined, { query: txQuery }, { query: txQuery }, undefined,
    ]);
    expect(f.writes).toHaveLength(0);
  });

  it('full schema permits guarded work; missing closure does not block overdue bundle', async () => {
    const schema = completeLoanSchema(); schema.tables = schema.tables.filter(t => t !== 'cierres_prestamo');
    const f = fixture(schema);
    await expect(f.overdue.assertAvailable()).resolves.toBeUndefined();
    await expect(loanSchemaTransaction(f.prisma, SANCTION_OPERATION_SCHEMA, 'test.write', async () => 'done')).resolves.toBe('done');
  });

  it('safe diagnostics separate schema, permissions, connectivity and other SQL', () => {
    expect(loanFailureDiagnostic(sqlError('42P01'))).toBe('SCHEMA_OBJECT_UNAVAILABLE');
    expect(loanFailureDiagnostic({ cause: sqlError('42501') })).toBe('PERMISSION_DENIED');
    expect(loanFailureDiagnostic(sqlError('08006'))).toBe('CONNECTION_UNAVAILABLE');
    expect(loanFailureDiagnostic(sqlError('42601'))).toBe('SQL_FAILURE');
  });

  it.each([
    ['42501', 'PERMISSION_DENIED'],
    ['08001', 'CONNECTION_UNAVAILABLE'],
    ['08006', 'CONNECTION_UNAVAILABLE'],
    ['ECONNREFUSED', 'CONNECTION_UNAVAILABLE'],
    ['ECONNRESET', 'CONNECTION_UNAVAILABLE'],
    ['ETIMEDOUT', 'CONNECTION_UNAVAILABLE'],
    ['ENOTFOUND', 'CONNECTION_UNAVAILABLE'],
  ])('classifies nested code/sqlState %s without inspecting private messages', (code, diagnostic) => {
    expect(loanFailureDiagnostic({ code: 'WRAPPER', cause: { sqlState: code, message: 'private' } })).toBe(diagnostic);
    expect(loanFailureDiagnostic({ cause: sqlError(code) })).toBe(diagnostic);
  });

  it('does not infer diagnostics from messages or retain arbitrary categories', () => {
    expect(loanFailureDiagnostic(new Error('42501 ECONNRESET private'))).toBe('OPERATION_FAILURE');
    const error = new SchemaCapabilityUnavailableException('test', 'SCHEMA_UNKNOWN');
    vi.spyOn(error, 'getResponse').mockReturnValue({ diagnostic: 'private arbitrary category' });
    expect(loanFailureDiagnostic(error)).toBe('OPERATION_FAILURE');
    const cyclic = { cause: null as unknown };
    cyclic.cause = cyclic;
    expect(loanFailureDiagnostic(cyclic)).toBe('OPERATION_FAILURE');
  });
});

describe('offline job pause/resume and bounded logs', () => {
  it('reports new categories immediately, deduplicates alternation per window and clears on recovery', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const logger = { warn: vi.fn(), log: vi.fn() };
    const monitor = new LoanJobMonitor(logger);
    const permission = sqlError('42501');
    const connection = sqlError('ECONNRESET');
    monitor.failed(permission);
    vi.setSystemTime(60_000);
    monitor.failed(connection);
    for (let i = 0; i < 10; i++) {
      monitor.failed(permission);
      monitor.failed(connection);
    }
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn.mock.calls[0]![0]).toContain('PERMISSION_DENIED');
    expect(logger.warn.mock.calls[1]![0]).toContain('CONNECTION_UNAVAILABLE');
    vi.setSystemTime(15 * 60_000 - 1);
    monitor.failed(permission);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    vi.setSystemTime(15 * 60_000);
    monitor.failed(permission);
    monitor.failed(connection);
    expect(logger.warn).toHaveBeenCalledTimes(3);
    vi.setSystemTime(16 * 60_000);
    monitor.failed(connection);
    expect(logger.warn).toHaveBeenCalledTimes(4);
    monitor.ready(); monitor.ready();
    expect(logger.log).toHaveBeenCalledTimes(1);
    monitor.failed(permission); monitor.failed(connection);
    expect(logger.warn).toHaveBeenCalledTimes(6);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private');
  });
  it('checks before candidates, pauses, reminds at most every 15m and resumes after provider TTL', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const f = fixture(oldSchema());
    const candidates = vi.spyOn(f.overdue, 'candidates').mockResolvedValue([]);
    const job = new LoanOverdueService(f.overdue);
    for (let i = 0; i < 4; i++) await job.synchronize();
    expect(candidates).not.toHaveBeenCalled(); expect(warn).toHaveBeenCalledTimes(1);
    f.setSchema(completeLoanSchema());
    await job.synchronize(); expect(candidates).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_001);
    await job.synchronize(); expect(candidates).toHaveBeenCalledTimes(1); expect(log).toHaveBeenCalledTimes(1);
    f.setSchema(oldSchema()); f.provider.invalidate();
    await job.synchronize(); expect(warn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    await job.synchronize(); expect(warn).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private SQL');
  });

  it('candidate query uses no new column and candidate failure is not assumed to be a missing migration', async () => {
    const f = fixture();
    await f.overdue.candidates(new Date(), 25);
    const plan = f.calls[0];
    expect(JSON.stringify(plan)).not.toMatch(/origen|categoriaId|termsVersionId|cierres_prestamo|ajustes_incumplimiento/);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(f.overdue, 'candidates').mockRejectedValue(sqlError('42501'));
    const job = new LoanOverdueService(f.overdue);
    await job.synchronize(); await job.synchronize();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('PERMISSION_DENIED');
  });

  it('expiry job shares bounded pause/resume without querying legacy candidates', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const f = fixture(oldSchema());
    const job = new ReservationExpiryService(f.reservations);
    await job.expire(); await job.expire();
    expect(f.calls).toHaveLength(0); expect(warn).toHaveBeenCalledTimes(1);
    f.setSchema(completeLoanSchema()); f.provider.invalidate();
    await job.expire(); expect(log).toHaveBeenCalledTimes(1);
  });
});
