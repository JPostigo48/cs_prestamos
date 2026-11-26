import 'reflect-metadata';
import 'temporal-polyfill/full/global';
import postgres from '@prisma/orm-postgres/runtime';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Contract } from '../prisma/contract.d.ts';
import contractJson from '../prisma/contract.json' with { type: 'json' };
import { PrismaInventoryRepository } from '../src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.js';
import { InventoryService } from '../src/modules/inventory/application/use-cases/inventory.service.js';
import { SchemaCapabilities } from '../src/shared/infrastructure/prisma/schema-capabilities.js';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { inventorySchema } from './helpers/inventory-schema.js';
import type { InventoryRepository } from '../src/modules/inventory/domain/repositories/inventory.repository.js';
import { InventoryController } from '../src/modules/inventory/presentation/controllers/inventory.controller.js';
import { AuthGuard } from '../src/modules/auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../src/modules/auth/presentation/guards/roles.guard.js';

const categoryId = '123e4567-e89b-42d3-a456-426614174001';
const resourceId = '123e4567-e89b-42d3-a456-426614174002';
const copyId = '123e4567-e89b-42d3-a456-426614174003';
const actor = { userId: 'staff', accountId: 'account' };
const native = postgres<Contract>({ contractJson }); // Builder only; never connect/runtime.
type Node = Record<string, any>;
type Row = Record<string, any>;
const schemaError = (code: string) =>
  Object.assign(new Error('absent schema object'), { code });

/** Executes the actual native AST. Rejects absent columns in WHERE, SELECT,
 * RETURNING and mutation payloads, and absent tables, before any simulated write.
 * Deliberately not a PostgreSQL isolation/DDL simulator.
 */
function fixture(
  initialColumns = ['condicionFisica', 'habilitado'],
  checks = true,
) {
  let columns = [...initialColumns];
  let metadata = inventorySchema(columns, checks);
  let unavailableMetadata = false;
  let rows: Record<string, Row[]> = {
    categorias_recurso: [
      {
        id: categoryId,
        nombre: 'Equipos',
        activo: true,
        tiempoMaximoPrestamoDias: 1,
        tiempoMaximoPrestamoHoras: 24,
      },
    ],
    recursos: [
      {
        id: resourceId,
        categoriaId: categoryId,
        nombre: 'Equipo',
        activo: true,
        duracionPrestamoHoras: null,
      },
    ],
    ejemplares: ['DISPONIBLE', 'PRESTADO', 'RESERVADO', 'NO_DISPONIBLE'].map(
      (estado, index) => ({
        id: index ? `${copyId.slice(0, -1)}${index + 3}` : copyId,
        recursoId: resourceId,
        codigoInventario: `COPY-${index}`,
        estado,
        ...(columns.includes('condicionFisica')
          ? { condicionFisica: 'APTO' }
          : {}),
        ...(columns.includes('habilitado') ? { habilitado: true } : {}),
      }),
    ),
    prestamos: [],
    reservas: [],
    observaciones_ejemplar: [],
    auditorias_usuario: [],
    accesorios_recurso: [],
  };
  const calls: Node[] = [];
  const writes: Node[] = [];
  let onTransaction: (() => void) | undefined;
  let onRead: (() => void) | undefined;
  let onCopyRead: (() => void) | undefined;
  let readError: unknown;
  let mutationError: unknown;
  const changeSchema = (next: string[], validChecks = true) => {
    columns = [...next];
    metadata = inventorySchema(columns, validChecks);
  };
  const value = (node: Node, row: Row): any => {
    if (node.kind === 'identifier-ref') return row[node.name];
    if (node.kind === 'column-ref') return row[node.column];
    if (node.kind === 'param-ref' || node.kind === 'literal') return node.value;
    if (node.kind === 'binary' && node.op === 'eq')
      return value(node.left, row) === value(node.right, row);
    if (node.kind === 'and')
      return node.exprs.every((part: Node) => value(part, row));
    throw new Error(`Unsupported fixture expression: ${JSON.stringify(node)}`);
  };
  const checkColumn = (table: string, name: string) => {
    if (
      table === 'ejemplares' &&
      ['condicionFisica', 'habilitado'].includes(name) &&
      !columns.includes(name)
    )
      throw schemaError('42703');
  };
  const validate = (node: unknown, table: string): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Node;
    if (n.kind === 'identifier-ref') checkColumn(table, n.name);
    if (n.kind === 'column-ref') checkColumn(n.table ?? table, n.column);
    if (n.kind === 'table-source' && !Object.hasOwn(rows, n.name))
      throw schemaError('42P01');
    for (const part of Object.values(n)) validate(part, table);
  };
  const query = vi.fn(async (plan: Node) => {
    const ast = plan.ast as Node;
    calls.push(ast);
    if (Array.isArray(ast.parts)) {
      const text = ast.parts
        .filter((p: unknown) => typeof p === 'string')
        .join('');
      if (text.includes('pg_catalog.pg_class')) {
        if (unavailableMetadata) throw new Error('metadata denied');
        return [{ metadata: JSON.stringify(metadata) }];
      }
      if (text.includes('LOCK TABLE')) return [];
      throw new Error('Unsupported raw query');
    }
    if (ast.kind === 'select') {
      const callback = onRead;
      onRead = undefined;
      callback?.();
      if (ast.from.name === 'ejemplares') {
        const copyCallback = onCopyRead;
        onCopyRead = undefined;
        copyCallback?.();
      }
      if (readError) {
        const error = readError;
        readError = undefined;
        throw error;
      }
    }
    const table: string = (ast.from ?? ast.table).name;
    validate(ast, table);
    for (const name of Object.keys(ast.set ?? {})) checkColumn(table, name);
    for (const item of ast.rows ?? [])
      for (const name of Object.keys(item)) checkColumn(table, name);
    if (ast.kind !== 'select' && mutationError) throw mutationError;
    let selected = rows[table]!.filter(
      (r) => !ast.where || value(ast.where, r),
    );
    if (ast.kind === 'update') {
      writes.push(ast);
      for (const row of selected)
        for (const [name, expr] of Object.entries(ast.set))
          row[name] = value(expr as Node, row);
    } else if (ast.kind === 'insert') {
      writes.push(ast);
      selected = ast.rows.map((r: Node) =>
        Object.fromEntries(
          Object.entries(r).map(([name, expr]) => [
            name,
            value(expr as Node, {}),
          ]),
        ),
      );
      rows[table]!.push(...selected);
    } else if (ast.kind !== 'select')
      throw new Error(`Unsupported mutation ${ast.kind}`);
    const projection: Node[] = ast.projection ?? ast.returning;
    return selected.map((r) =>
      Object.fromEntries(projection.map((p) => [p.alias, value(p.expr, r)])),
    );
  });
  const runtime = { query };
  const client = {
    raw: native.raw,
    runtime: () => runtime,
    transaction: async (work: (tx: typeof runtime) => Promise<unknown>) => {
      onTransaction?.();
      const previous = Object.fromEntries(
        Object.entries(rows).map(([name, items]) => [
          name,
          items.map((r) => ({ ...r })),
        ]),
      );
      try {
        return await work(runtime);
      } catch (error) {
        rows = previous;
        throw error;
      }
    },
  };
  const capabilities = new SchemaCapabilities(client as never);
  const prisma = {
    sql: native.sql,
    client,
    schemaCapabilities: capabilities,
  } as unknown as PrismaService;
  const repository = new PrismaInventoryRepository(prisma);
  const service = new InventoryService(repository);
  return {
    repository,
    service,
    runtime,
    calls,
    writes,
    capabilities,
    query,
    rows: (table: string) => rows[table]!,
    changeSchema,
    metadataUnavailable: () => {
      unavailableMetadata = true;
    },
    atTransaction: (callback: () => void) => {
      onTransaction = callback;
    },
    atRead: (callback: () => void) => {
      onRead = callback;
    },
    atCopyRead: (callback: () => void) => {
      onCopyRead = callback;
    },
    failRead: (error: unknown) => {
      readError = error;
    },
    failMutation: (error: unknown) => {
      mutationError = error;
    },
  };
}

describe('inventory schema compatibility / native SQL / no database', () => {
  it('the strict double itself rejects absent SELECT/WHERE/RETURNING/write columns and tables', async () => {
    const f = fixture([]);
    for (const plan of [
      native.sql.public.ejemplares.select('condicionFisica').build(),
      native.sql.public.ejemplares
        .select('id')
        .where((r, f) => f.eq(r.habilitado, true))
        .build(),
      native.sql.public.ejemplares
        .update({ codigoInventario: 'X' })
        .returning('habilitado')
        .build(),
      native.sql.public.ejemplares
        .update({ habilitado: true })
        .returning('id')
        .build(),
    ])
      await expect(f.query(plan)).rejects.toMatchObject({ code: '42703' });
    await expect(
      f.query(native.sql.public.cierres_prestamo.select('id').build()),
    ).rejects.toMatchObject({ code: '42P01' });
    expect(f.writes).toEqual([]);
  });

  it.each([
    ['old', [], false],
    ['condition only', ['condicionFisica'], false],
    ['enablement only', ['habilitado'], false],
    ['new', ['condicionFisica', 'habilitado'], true],
  ] as const)(
    '%s: projects only existing columns and preserves every occupancy state',
    async (_name, columns, ready) => {
      const f = fixture([...columns]);
      const copies = await f.repository.findCopiesByResource(resourceId);
      expect(copies.map((c) => c.estado)).toEqual([
        'DISPONIBLE',
        'PRESTADO',
        'RESERVADO',
        'NO_DISPONIBLE',
      ]);
      expect(copies[0]).toMatchObject({
        condicionFisica: columns.includes('condicionFisica' as never)
          ? 'APTO'
          : null,
        habilitado: columns.includes('habilitado' as never) ? true : null,
        compatibility: { status: ready ? 'READY' : 'UPDATE_PENDING' },
      });
      expect(await f.repository.findCopyById(copyId)).toEqual(copies[0]);
      expect(
        await f.repository.countAvailableCopiesByResource(resourceId),
      ).toBe(ready ? 1 : null);
      expect(f.writes).toEqual([]);
      for (const ast of f.calls.filter(
        (p) => p.kind === 'select' && p.from.name === 'ejemplares',
      )) {
        const text = JSON.stringify(ast);
        for (const absent of ['condicionFisica', 'habilitado'].filter(
          (c) => !columns.includes(c as never),
        ))
          expect(text).not.toContain(absent);
      }
    },
  );

  it.each(
    [
      [],
      ['condicionFisica'],
      ['habilitado'],
      ['condicionFisica', 'habilitado'],
    ].map((columns) => [columns]),
  )(
    'actual count SQL tolerates schema %j and never references unrelated new objects',
    async (columns) => {
      const f = fixture(columns);
      await f.repository.countAvailableCopiesByResource(resourceId);
      expect(
        JSON.stringify(f.calls.filter((p) => !Array.isArray(p.parts))),
      ).not.toMatch(/cierres_prestamo|ajustes_incumplimiento/);
    },
  );

  it.each(
    [[], ['condicionFisica'], ['habilitado']].map((columns) => [columns]),
  )(
    'legacy/partial %j: resource reads separate registered stock and unknown verified availability',
    async (columns) => {
      const f = fixture(columns);
      const expected = {
        available: null,
        totalCopies: 4,
        registeredStock: {
          libres: 1,
          prestados: 1,
          retenidos: 1,
          reservados: 1,
        },
        compatibility: {
          status: 'UPDATE_PENDING',
          capabilities: { verifiedAvailability: false },
          actions: { create: false, rehabilitate: false },
        },
      };
      expect(await f.service.getResourceAvailability(resourceId)).toMatchObject(
        {
          ...expected,
          disponibles: null,
          noDisponibles: null,
          prestados: 1,
          reservados: 1,
        },
      );
      expect((await f.service.listResources()).data[0]).toMatchObject({
        ...expected,
        availableCopies: null,
      });
      expect(await f.service.getResource(resourceId)).toMatchObject(expected);
      expect((await f.service.getGlobalAvailability())[0]).toMatchObject({
        ...expected,
        disponibles: null,
        noDisponibles: null,
      });
      expect(
        (await f.service.listResources({ available: 'true' })).data,
      ).toEqual([]);
      expect(
        (await f.service.listResources({ available: 'false' })).data,
      ).toEqual([]);
      expect(await f.service.getCopy(copyId)).toMatchObject({
        estado: 'DISPONIBLE',
        compatibility: { status: 'UPDATE_PENDING' },
      });
      await expect(f.service.getLoanAvailability(copyId)).rejects.toMatchObject(
        {
          response: { statusCode: 503, code: 'SCHEMA_CAPABILITY_UNAVAILABLE' },
        },
      );
      expect(f.writes).toEqual([]);
    },
  );

  const risky = [
    [
      'createCategory',
      (r: InventoryRepository) =>
        r.createCategory({ nombre: 'New', tiempoMaximoPrestamoDias: 1 }),
    ],
    [
      'createResource',
      (r: InventoryRepository) =>
        r.createResource({ categoriaId: categoryId, nombre: 'New' }),
    ],
    [
      'createCopy',
      (r: InventoryRepository) =>
        r.createCopy({ recursoId: resourceId, codigoInventario: 'NEW' }),
    ],
    [
      'activateCategory',
      (r: InventoryRepository) =>
        r.updateCategory(categoryId, { nombre: 'Not written', activo: true }),
    ],
    [
      'activateResource',
      (r: InventoryRepository) =>
        r.updateResource(resourceId, { nombre: 'Not written', activo: true }),
    ],
    [
      'moveResource',
      (r: InventoryRepository) =>
        r.updateResource(resourceId, { categoriaId: categoryId }),
    ],
    [
      'enableCopy',
      (r: InventoryRepository) =>
        r.updateManagedCopy(copyId, {
          codigoInventario: 'Not written',
          habilitado: true,
        }),
    ],
    [
      'releaseCopy',
      (r: InventoryRepository) => r.updateCopyState(copyId, 'DISPONIBLE'),
    ],
    [
      'rehabilitate',
      (r: InventoryRepository) =>
        r.updateManagedCopy(copyId, {
          estado: 'DISPONIBLE',
          verification: {
            fitForLoan: true,
            componentsComplete: true,
            reason: 'Verified',
            evidenceIds: [],
          },
        }),
    ],
    [
      'retain',
      (r: InventoryRepository) => r.updateCopyState(copyId, 'NO_DISPONIBLE'),
    ],
    ['deactivateCopy', (r: InventoryRepository) => r.deleteCopy(copyId)],
    ['loan', (r: InventoryRepository) => r.markCopyAsLoaned(copyId)],
  ] as const;

  it.each(risky)(
    '%s: old, partial, missing CHECK and unknown metadata reject with ZERO writes including audit/locks',
    async (_name, work) => {
      for (const columns of [
        [],
        ['condicionFisica'],
        ['habilitado'],
        ['condicionFisica', 'habilitado'],
      ]) {
        const f = fixture(columns, false);
        await expect(
          f.repository.audited(actor, 'TEST', work),
        ).rejects.toMatchObject({
          response: { statusCode: 503, diagnostic: 'SCHEMA_INCOMPLETE' },
        });
        expect(f.writes).toEqual([]);
      }
      const f = fixture();
      f.metadataUnavailable();
      await expect(work(f.repository)).rejects.toMatchObject({
        response: { diagnostic: 'SCHEMA_UNKNOWN' },
      });
      expect(f.writes).toEqual([]);
    },
  );

  it.each(risky)(
    '%s: cached complete schema is revalidated INSIDE transaction before first write',
    async (_name, work) => {
      const f = fixture();
      await f.capabilities.snapshot();
      f.atTransaction(() => f.changeSchema([]));
      await expect(work(f.repository)).rejects.toMatchObject({
        response: { diagnostic: 'SCHEMA_INCOMPLETE' },
      });
      expect(f.writes).toEqual([]);
    },
  );

  it.each(
    [[], ['condicionFisica'], ['habilitado']].map((columns) => [columns]),
  )(
    'legacy descriptive edits %j are proven safe and audited without repairing/enabling/releasing',
    async (columns) => {
      const f = fixture(columns);
      const before = structuredClone(f.rows('ejemplares'));
      await f.repository.audited(actor, 'DESCRIPTION', async (r) => {
        await r.updateCategory(categoryId, {
          nombre: 'Renamed category',
          descripcion: 'Description',
        });
        await r.updateResource(resourceId, {
          nombre: 'Renamed resource',
          descripcion: 'Description',
        });
        await r.updateManagedCopy(copyId, { codigoInventario: 'RENAMED' });
        await r.createObservation({
          ejemplarId: copyId,
          descripcion: 'Observation',
        });
      });
      expect(
        f.rows('ejemplares').map((r) => ({
          estado: r.estado,
          condicionFisica: r.condicionFisica,
          habilitado: r.habilitado,
        })),
      ).toEqual(
        before.map((r) => ({
          estado: r.estado,
          condicionFisica: r.condicionFisica,
          habilitado: r.habilitado,
        })),
      );
      expect(f.rows('ejemplares')[0]!.codigoInventario).toBe('RENAMED');
      expect(f.rows('auditorias_usuario')).toHaveLength(1);
    },
  );

  it('new schema: known counts, explicit healthy creation and transactional assertions before writes', async () => {
    const f = fixture();
    expect(await f.service.getResourceAvailability(resourceId)).toMatchObject({
      available: true,
      disponibles: 1,
      noDisponibles: 1,
      totalCopies: 4,
    });
    const spy = vi.spyOn(f.capabilities, 'assert');
    expect(
      await f.repository.createCopy({
        recursoId: resourceId,
        codigoInventario: 'NEW',
      }),
    ).toMatchObject({ condicionFisica: 'APTO', habilitado: true });
    expect(spy).toHaveBeenCalledWith(
      'copyPhysicalState',
      'inventory.createCopy',
      f.runtime,
    );
    expect(f.writes).toHaveLength(1);
  });

  it('empty catalog still exposes schema action prerequisites at page level', async () => {
    const f = fixture([]);
    f.rows('recursos').splice(0);
    expect(await f.service.listResources()).toMatchObject({
      data: [],
      total: 0,
      compatibility: { status: 'UPDATE_PENDING', actions: { create: false } },
    });
  });

  it('both columns without the CHECK are projected, but cannot verify availability; empty legacy stock is not available zero', async () => {
    const partial = fixture(['condicionFisica', 'habilitado'], false);
    expect(await partial.repository.findCopyById(copyId)).toMatchObject({
      condicionFisica: 'APTO',
      habilitado: true,
      compatibility: { status: 'UPDATE_PENDING' },
    });
    expect(
      await partial.repository.countAvailableCopiesByResource(resourceId),
    ).toBeNull();
    const old = fixture([]);
    old.rows('ejemplares').splice(0);
    expect(await old.service.getResourceAvailability(resourceId)).toMatchObject(
      {
        totalCopies: 0,
        disponibles: null,
        available: null,
        noDisponibles: null,
      },
    );
    old.rows('recursos')[0]!.activo = false;
    expect(
      await old.repository.countAvailableCopiesByResource(resourceId),
    ).toBeNull();
  });

  it('actual count WHERE fails with 42703 after cached schema drift and safely becomes unknown, not zero', async () => {
    const f = fixture();
    await f.capabilities.snapshot();
    f.atCopyRead(() => f.changeSchema([]));
    expect(
      await f.repository.countAvailableCopiesByResource(resourceId),
    ).toBeNull();
    const copyQueries = f.calls.filter(
      (p) => p.kind === 'select' && p.from.name === 'ejemplares',
    );
    expect(copyQueries).toHaveLength(1);
    expect(JSON.stringify(copyQueries[0])).toContain('condicionFisica');
    expect((await f.repository.getCompatibility()).status).toBe(
      'UPDATE_PENDING',
    );
    expect(f.writes).toEqual([]);
  });

  it('a schema failure on a write is propagated without retry/fallback', async () => {
    const f = fixture();
    const error = schemaError('42703');
    f.failMutation(error);
    await expect(
      f.repository.createCopy({
        recursoId: resourceId,
        codigoInventario: 'NEW',
      }),
    ).rejects.toBe(error);
    expect(f.calls.filter((p) => p.kind === 'insert')).toHaveLength(1);
    expect(f.writes).toEqual([]);
  });

  it.each(
    [
      [],
      ['condicionFisica'],
      ['habilitado'],
      ['condicionFisica', 'habilitado'],
    ].map((columns) => [columns]),
  )(
    'HTTP serialization %j: exact nullable values, additive metadata and guarded mutations',
    async (columns) => {
      const f = fixture(columns);
      Reflect.defineMetadata(
        'design:paramtypes',
        [InventoryService],
        InventoryController,
      );
      const module = await Test.createTestingModule({
        controllers: [InventoryController],
        providers: [{ provide: InventoryService, useValue: f.service }],
      })
        .overrideGuard(AuthGuard)
        .useValue({
          canActivate: (context: any) => {
            context.switchToHttp().getRequest().user = actor;
            return true;
          },
        })
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();
      const app = module.createNestApplication();
      await app.init();
      try {
        const ready = columns.length === 2;
        const copies = await request(app.getHttpServer())
          .get(`/inventory/resources/${resourceId}/copies`)
          .expect(200);
        expect(copies.body[0]).toMatchObject({
          estado: 'DISPONIBLE',
          condicionFisica: columns.includes('condicionFisica') ? 'APTO' : null,
          habilitado: columns.includes('habilitado') ? true : null,
          compatibility: { status: ready ? 'READY' : 'UPDATE_PENDING' },
        });
        const page = await request(app.getHttpServer())
          .get('/inventory/resources')
          .expect(200);
        expect(page.body).toMatchObject({
          compatibility: { status: ready ? 'READY' : 'UPDATE_PENDING' },
        });
        expect(page.body.data[0]).toMatchObject({
          available: ready ? true : null,
          availableCopies: ready ? 1 : null,
          totalCopies: 4,
          registeredStock: {
            libres: 1,
            prestados: 1,
            retenidos: 1,
            reservados: 1,
          },
        });
        const availability = await request(app.getHttpServer())
          .get(`/inventory/resources/${resourceId}/availability`)
          .expect(200);
        expect(availability.body).toMatchObject({
          disponibles: ready ? 1 : null,
          noDisponibles: ready ? 1 : null,
        });
        if (!ready) {
          const rejected = await request(app.getHttpServer())
            .post(`/inventory/resources/${resourceId}/copies`)
            .send({ codigoInventario: 'NEW' })
            .expect(503);
          expect(rejected.body).toMatchObject({
            statusCode: 503,
            code: 'SCHEMA_CAPABILITY_UNAVAILABLE',
            diagnostic: 'SCHEMA_INCOMPLETE',
          });
          expect(f.writes).toEqual([]);
          const edited = await request(app.getHttpServer())
            .patch(`/inventory/resources/${resourceId}`)
            .send({ descripcion: 'Legacy edit' })
            .expect(200);
          expect(edited.body).toMatchObject({
            descripcion: 'Legacy edit',
            totalCopies: 4,
            availableCopies: null,
          });
        }
      } finally {
        await app.close();
      }
    },
  );

  it.each(['42703', '42P01'])(
    'read-only %s invalidates and retries with a fresh legacy projection, including count',
    async (code) => {
      for (const read of [
        (r: PrismaInventoryRepository) => r.findCopiesByResource(resourceId),
        (r: PrismaInventoryRepository) =>
          r.countAvailableCopiesByResource(resourceId),
      ]) {
        const f = fixture();
        await f.capabilities.snapshot();
        f.atRead(() => f.changeSchema([]));
        f.failRead(schemaError(code));
        const result = await read(f.repository);
        if (Array.isArray(result))
          expect(result[0]).toMatchObject({
            condicionFisica: null,
            habilitado: null,
          });
        else expect(result).toBeNull();
        expect(f.writes).toEqual([]);
      }
    },
  );

  it.each(['42501', '08006', '57014', 'XX000'])(
    'does not swallow operational error %s as null or zero',
    async (code) => {
      const f = fixture();
      const error = schemaError(code);
      f.failRead(error);
      await expect(
        f.repository.countAvailableCopiesByResource(resourceId),
      ).rejects.toBe(error);
      expect(f.writes).toEqual([]);
    },
  );

  it('unknown metadata never runs user-data queries; transaction read failures are never retried', async () => {
    const f = fixture();
    f.metadataUnavailable();
    await expect(
      f.repository.findCopiesByResource(resourceId),
    ).rejects.toMatchObject({ response: { diagnostic: 'SCHEMA_UNKNOWN' } });
    expect(f.calls.every((p) => Array.isArray(p.parts))).toBe(true);
    const tx = fixture();
    const error = schemaError('42703');
    tx.failRead(error);
    await expect(
      tx.repository.forTransaction(tx.runtime as never).findCopyById(copyId),
    ).rejects.toBe(error);
    expect(tx.calls.filter((p) => p.kind === 'select')).toHaveLength(1);
  });
});
