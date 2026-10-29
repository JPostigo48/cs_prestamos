import 'reflect-metadata';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  DocumentBuilder,
  SwaggerModule,
  type SchemaObject,
} from '@nestjs/swagger';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import postgres from '@prisma/orm-postgres/runtime';
import { Temporal } from 'temporal-polyfill/full';
import contractJson from '../prisma/contract.json' with { type: 'json' };
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';
import { PrismaLoanRepository } from '../src/modules/loans/infrastructure/persistence/prisma/prisma-loan.repository.js';
import { PrismaReservationRepository } from '../src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.js';
import { PrismaInventoryRepository } from '../src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.js';
import { InventoryService } from '../src/modules/inventory/application/use-cases/inventory.service.js';
import {
  ListReservationsUseCase,
  ListResourceHistoryUseCase,
  SaveReturnChecklistUseCase,
} from '../src/modules/loans/application/use-cases/loan-contracts.use-cases.js';
import { GetLoanUseCase } from '../src/modules/loans/application/use-cases/get-loan.use-case.js';
import { ReturnLoanUseCase } from '../src/modules/loans/application/use-cases/return-loan.use-case.js';
import { ListActiveLoansUseCase } from '../src/modules/loans/application/use-cases/list-active-loans.use-case.js';
import { ListOverdueLoansUseCase } from '../src/modules/loans/application/use-cases/list-overdue-loans.use-case.js';
import { ListUserLoanHistoryUseCase } from '../src/modules/loans/application/use-cases/list-user-loan-history.use-case.js';
import { CreateReservationUseCase } from '../src/modules/loans/application/use-cases/create-reservation.use-case.js';
import { PickupReservationUseCase } from '../src/modules/loans/application/use-cases/pickup-reservation.use-case.js';
import { CancelReservationUseCase } from '../src/modules/loans/application/use-cases/cancel-reservation.use-case.js';
import { LoansController } from '../src/modules/loans/presentation/controllers/loans.controller.js';
import {
  ReservationsQueryDto,
  ResourceHistoryQueryDto,
  SaveReturnChecklistDto,
} from '../src/modules/loans/presentation/dto/loan-contracts.dto.js';
import { ReturnLoanDto } from '../src/modules/loans/presentation/dto/return-loan.dto.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';
import { JwtTokenAdapter } from '../src/modules/auth/infrastructure/security/jwt-token.adapter.js';
import { AuthGuard } from '../src/modules/auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../src/modules/auth/presentation/guards/roles.guard.js';
import { deriveAuthorization } from '../src/shared/presentation/openapi/authorization-metadata.js';
import type { CopyLoanSnapshot } from '../src/modules/inventory/domain/entities/resource-configuration.js';

vi.mock('dotenv/config', () => ({}));
const uuid = (n: number) =>
  `123e4567-e89b-42d3-a456-${String(n).padStart(12, '0')}`;
const resourceId = uuid(1),
  categoryId = uuid(2),
  copyId = uuid(3),
  userId = uuid(4),
  actorId = uuid(5),
  loanId = uuid(6),
  accessoryId = uuid(7),
  otherCopy = uuid(8),
  otherUser = uuid(9);
const snapshot: CopyLoanSnapshot = {
  schemaVersion: 1,
  copyId,
  resourceId,
  policy: {
    resourceId,
    categoryId,
    durationHours: null,
    effectiveDurationHours: 8,
    source: 'CATEGORY',
  },
  accessories: [{ id: accessoryId, nombre: 'Cable original' }],
};
const past = () => new Date(Date.now() - 600000);
const checklistBody = () => ({
  checkedAt: new Date().toISOString(),
  parts: [{ accessoryId, received: true }],
});

describe('F08/F09/F14 HTTP + production repositories, isolated SQL/transactions in memory (not PostgreSQL)', () => {
  let app: INestApplication;
  let db: ReturnType<typeof inMemoryPrisma>;
  let loans: PrismaLoanRepository;
  let reservations: PrismaReservationRepository;
  let inventory: InventoryService;
  let jwt: JwtTokenAdapter;
  let enabled = true;
  beforeEach(async () => {
    vi.stubEnv('JWT_SECRET', 'isolated-loans-contract-tests-only');
    vi.stubEnv('JWT_EXPIRES_IN', '3600s');
    enabled = true;
    db = inMemoryPrisma({
      usuarios: [
        { id: userId, vinculacionVigente: true },
        { id: actorId, vinculacionVigente: true },
        { id: otherUser, vinculacionVigente: true },
      ],
      recursos: [
        {
          id: resourceId,
          categoriaId: categoryId,
          nombre: 'Equipo',
          duracionPrestamoHoras: null,
        },
      ],
      categorias_recurso: [
        {
          id: categoryId,
          nombre: 'Categoría',
          tiempoMaximoPrestamoDias: 2,
          tiempoMaximoPrestamoHoras: 8,
        },
      ],
      accesorios_recurso: [
        {
          id: accessoryId,
          recursoId: resourceId,
          nombre: 'Cable original',
          nombreNormalizado: 'cable original',
          activo: true,
        },
      ],
      ejemplares: [
        {
          id: copyId,
          recursoId: resourceId,
          codigoInventario: 'T-1',
          estado: 'PRESTADO',
        },
        {
          id: otherCopy,
          recursoId: resourceId,
          codigoInventario: 'T-2',
          estado: 'NO_DISPONIBLE',
        },
      ],
      prestamos: [
        {
          id: loanId,
          usuarioId: userId,
          ejemplarId: copyId,
          fechaInicio: past(),
          fechaFin: new Date(Date.now() + 3600000),
          estado: 'ACTIVO',
          configurationSnapshot: structuredClone(snapshot),
        },
      ],
      reservas: [
        {
          id: uuid(10),
          usuarioId: userId,
          ejemplarId: copyId,
          fechaSolicitada: past(),
          fechaLimiteRecogida: new Date(),
          duracionPrestamoHoras: 8,
          estado: 'RECOGIDA',
          fechaRecogida: past(),
          fechaCancelacion: null,
          motivoCancelacion: null,
        },
        {
          id: uuid(11),
          usuarioId: otherUser,
          ejemplarId: otherCopy,
          fechaSolicitada: past(),
          fechaLimiteRecogida: new Date(),
          duracionPrestamoHoras: 4,
          estado: 'CONFIRMADA',
          fechaRecogida: null,
          fechaCancelacion: null,
          motivoCancelacion: null,
        },
      ],
    });
    // El ORM decodifica timestamptz como Temporal.Instant, no Date.
    for (const table of ['prestamos', 'reservas'])
      for (const row of db.rows(table)) {
        for (const [key, value] of Object.entries(row))
          if (value instanceof Date)
            row[key] = Temporal.Instant.from(value.toISOString());
      }
    const prisma = db as unknown as PrismaService;
    loans = new PrismaLoanRepository(prisma);
    reservations = new PrismaReservationRepository(prisma);
    inventory = new InventoryService(new PrismaInventoryRepository(prisma));
    jwt = new JwtTokenAdapter();
    const cases = [
      ReturnLoanUseCase,
      GetLoanUseCase,
      ListActiveLoansUseCase,
      ListUserLoanHistoryUseCase,
      ListOverdueLoansUseCase,
      CreateReservationUseCase,
      PickupReservationUseCase,
      CancelReservationUseCase,
      ListReservationsUseCase,
      ListResourceHistoryUseCase,
      SaveReturnChecklistUseCase,
    ];
    Reflect.defineMetadata('design:paramtypes', cases, LoansController);
    for (const [method, params] of [
      ['reservations', [ReservationsQueryDto, Object]],
      ['resourceHistory', [String, ResourceHistoryQueryDto]],
      ['returnChecklist', [String, SaveReturnChecklistDto, Object]],
      ['getById', [String, Object]],
      ['registerReturn', [String, ReturnLoanDto]],
    ] as const)
      Reflect.defineMetadata(
        'design:paramtypes',
        params,
        LoansController.prototype,
        method,
      );
    const instances = [
      new ReturnLoanUseCase(loans),
      new GetLoanUseCase(loans),
      new ListActiveLoansUseCase(loans),
      new ListUserLoanHistoryUseCase(loans),
      new ListOverdueLoansUseCase(loans),
      {},
      {},
      {},
      new ListReservationsUseCase(reservations),
      new ListResourceHistoryUseCase(loans),
      new SaveReturnChecklistUseCase(loans),
    ];
    const module = await Test.createTestingModule({
      controllers: [LoansController],
      providers: cases.map((provide, i) => ({
        provide,
        useValue: instances[i],
      })),
    })
      .overrideGuard(AuthGuard)
      .useValue(
        new AuthGuard(jwt, {
          findById: async (id: string) => ({
            id,
            userId: id === AccessRole.USER ? userId : actorId,
            role: id,
            enabled,
          }),
        } as any),
      )
      .overrideGuard(RolesGuard)
      .useValue(new RolesGuard(new Reflector()))
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
  const token = (role = AccessRole.OPERATOR) =>
    jwt.sign({
      accountId: role,
      userId: role === AccessRole.USER ? userId : actorId,
      role,
      userType: 'ESTUDIANTE',
    });
  const get = (path: string, role = AccessRole.OPERATOR) =>
    request(app.getHttpServer())
      .get(path)
      .auth(token(role), { type: 'bearer' });
  const inspect = (
    body: object = checklistBody(),
    role = AccessRole.OPERATOR,
    id = loanId,
  ) =>
    request(app.getHttpServer())
      .post(`/loans/${id}/return-checklist`)
      .auth(token(role), { type: 'bearer' })
      .send(body);

  it.each(['/loans/reservations', `/loans/resource/${resourceId}/history`])(
    'requires JWT and current enabled account for %s',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer())
        .get(path)
        .auth('invalid.jwt', { type: 'bearer' })
        .expect(401);
      enabled = false;
      await get(path).expect(401);
    },
  );
  it('enforces operational roles for resource history and inspection, but permits own reservations', async () => {
    await get(`/loans/resource/${resourceId}/history`, AccessRole.USER).expect(
      403,
    );
    await inspect(checklistBody(), AccessRole.USER).expect(403);
    for (const role of [AccessRole.OPERATOR, AccessRole.ADMINISTRATOR]) {
      await get(`/loans/resource/${resourceId}/history`, role).expect(200);
      await inspect(checklistBody(), role).expect(201);
    }
    const own = await get('/loans/reservations', AccessRole.USER).expect(200);
    expect(own.body.total).toBe(1);
    expect(own.body.items.every((r: any) => r.userId === userId)).toBe(true);
    await get(
      `/loans/reservations?userId=${otherUser}`,
      AccessRole.USER,
    ).expect(403);
    await get(`/loans/reservations?userId=${userId}`, AccessRole.USER).expect(
      200,
    );
  });
  it('keeps loan detail ownership even with snapshots and audit information', async () => {
    db.rows('prestamos')[0]!.usuarioId = otherUser;
    await get(`/loans/${loanId}`, AccessRole.USER).expect(403);
    await get(`/loans/${loanId}`).expect(200);
  });
  it.each([
    'page=0',
    'page=1.2',
    'page=21474837',
    'limit=101',
    'limit=0',
    'status=BAD',
    'userId=no',
    'copyId=no',
    'page[]=1',
    'extra=1',
  ])('rejects reservation query %s', async (query) => {
    await get(`/loans/reservations?${query}`).expect(400);
  });
  it('lists/paginates/filters before slicing and resolves article to every copy', async () => {
    db.rows('prestamos').push({
      ...db.rows('prestamos')[0],
      id: uuid(12),
      ejemplarId: otherCopy,
      estado: 'FINALIZADO',
    });
    const history = await get(
      `/loans/resource/${resourceId}/history?limit=1&page=2`,
    ).expect(200);
    expect(history.body).toMatchObject({ total: 2, page: 2, limit: 1 });
    expect(history.body.items[0].copyId).toBe(otherCopy);
    const filtered = await get(
      `/loans/resource/${resourceId}/history?status=ACTIVO`,
    ).expect(200);
    expect(filtered.body.total).toBe(1);
    await get(`/loans/resource/${copyId}/history`).expect(404);
    await get('/loans/resource/no/history').expect(400);
    await get(`/loans/resource/${resourceId}/history?status=BAD`).expect(400);
    const list = await get(
      `/loans/reservations?status=CONFIRMADA&copyId=${otherCopy}&limit=1`,
    ).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].userId).toBe(otherUser);
    const empty = await get('/loans/reservations?page=5').expect(200);
    expect(empty.body).toMatchObject({ items: [], total: 2, page: 5 });
  });
  it.each([
    { parts: null, checkedAt: new Date().toISOString() },
    { parts: [null], checkedAt: new Date().toISOString() },
    { parts: [], checkedAt: 'bad' },
    { parts: [], checkedAt: '2026-10-28' },
    {
      parts: [{ accessoryId: 'no', received: true }],
      checkedAt: new Date().toISOString(),
    },
    {
      parts: [{ accessoryId, received: 'true' }],
      checkedAt: new Date().toISOString(),
    },
    { ...checklistBody(), actorId: otherUser },
    { ...checklistBody(), parts: [] },
    { ...checklistBody(), parts: [{ accessoryId: uuid(99), received: true }] },
    {
      ...checklistBody(),
      parts: [
        { accessoryId, received: true },
        { accessoryId, received: true },
      ],
    },
  ])(
    'rejects malformed/incomplete inspection %# without persistence',
    async (body) => {
      await inspect(body).expect(400);
      expect(db.rows('inspecciones_devolucion')).toHaveLength(0);
      expect(db.rows('prestamos')[0]!.estado).toBe('ACTIVO');
    },
  );
  it('persists actor, original names and snapshot, returns the same immutable capture on retries', async () => {
    await inventory.replaceAccessories(resourceId, [
      { id: accessoryId, nombre: 'Cable actual' },
    ]);
    const first = await inspect().expect(201);
    expect(first.body).toMatchObject({
      actorId,
      loanId,
      configurationSnapshot: snapshot,
      parts: [{ accessoryId, nombre: 'Cable original', received: true }],
    });
    const retry = await inspect().expect(201);
    expect(retry.body).toEqual(first.body);
    await inspect({
      ...checklistBody(),
      parts: [{ accessoryId, received: false }],
    }).expect(409);
    expect(db.rows('inspecciones_devolucion')).toHaveLength(1);
    expect(db.rows('devoluciones')).toHaveLength(0);
    expect(db.rows('ejemplares')[0]!.estado).toBe('PRESTADO');
  });
  it('handles legacy without inventing accessories, and rejects new inspection after completion', async () => {
    db.rows('prestamos')[0]!.configurationSnapshot = null;
    await inspect().expect(400);
    const result = await inspect({
      checkedAt: new Date().toISOString(),
      parts: [],
    }).expect(201);
    expect(result.body).toMatchObject({
      configurationSnapshot: null,
      parts: [],
    });
    db.rows('inspecciones_devolucion').splice(0);
    db.rows('prestamos')[0]!.estado = 'FINALIZADO';
    await inspect({ checkedAt: new Date().toISOString(), parts: [] }).expect(
      409,
    );
  });
  it('rejects non-active, missing loans and inconsistent inspection dates', async () => {
    await inspect(checklistBody(), AccessRole.OPERATOR, uuid(999)).expect(404);
    await inspect(checklistBody(), AccessRole.OPERATOR, 'bad').expect(400);
    await inspect({
      ...checklistBody(),
      checkedAt: new Date(Date.now() + 60000).toISOString(),
    }).expect(409);
    await inspect({
      ...checklistBody(),
      checkedAt: new Date(Date.now() - 3600000).toISOString(),
    }).expect(409);
    db.rows('prestamos')[0]!.estado = 'PLANIFICADO';
    await inspect().expect(409);
  });
  it('keeps inspection separate; missing parts require incident, retries never duplicate return/copy effects', async () => {
    const inspection = await inspect({
      ...checklistBody(),
      parts: [{ accessoryId, received: false }],
    }).expect(201);
    await loans.registerReturnWithCopy({ loanId, returnedAt: new Date() }).then(
      () => {
        throw new Error('expected rejection');
      },
      (e) => expect(e.status).toBe(409),
    );
    expect(db.rows('devoluciones')).toHaveLength(0);
    await loans.registerReturnWithCopy({
      loanId,
      returnedAt: new Date(),
      observation: 'Falta cable',
    });
    expect(db.rows('ejemplares')[0]!.estado).toBe('NO_DISPONIBLE');
    expect(db.rows('observaciones_ejemplar')).toHaveLength(1);
    db.rows('ejemplares')[0]!.estado = 'RESERVADO';
    await expect(
      loans.registerReturnWithCopy({
        loanId,
        returnedAt: new Date(),
        observation: 'Falta cable',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.rows('devoluciones')).toHaveLength(1);
    expect(db.rows('observaciones_ejemplar')).toHaveLength(1);
    expect(db.rows('ejemplares')[0]!.estado).toBe('RESERVADO');
    const retry = await inspect({
      ...checklistBody(),
      parts: [{ accessoryId, received: false }],
    }).expect(201);
    expect(retry.body.id).toBe(inspection.body.id);
    expect(db.rows('sanciones')).toHaveLength(0);
  });
  it('allows existing basic return without inspection, and rolls back all effects on persistence error', async () => {
    const runtime = db.client.runtime();
    const original = runtime.query.bind(runtime);
    const spy = vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
      if (
        plan.table === 'observaciones_ejemplar' &&
        plan.operation === 'insert'
      )
        throw new Error('isolated storage failure');
      return original(plan);
    });
    await expect(
      loans.registerReturnWithCopy({
        loanId,
        returnedAt: new Date(),
        observation: 'Revisar',
      }),
    ).rejects.toThrow('isolated storage failure');
    expect(db.rows('devoluciones')).toHaveLength(0);
    expect(db.rows('prestamos')[0]!.estado).toBe('ACTIVO');
    expect(db.rows('ejemplares')[0]!.estado).toBe('PRESTADO');
    spy.mockRestore();
    await loans.registerReturnWithCopy({ loanId, returnedAt: new Date() });
    expect(db.rows('ejemplares')[0]!.estado).toBe('DISPONIBLE');
  });
  it('captures effective policy/accessories inside create transaction and transfers without consulting changed inventory', async () => {
    db.rows('ejemplares')[0]!.estado = 'DISPONIBLE';
    const reservation = await reservations.create({
      userId,
      copyId,
      enforceSingleOpenOperation: false,
      requestedAt: past(),
      pickupDeadline: new Date(Date.now() + 600000),
      loanDurationHours: 999,
    });
    expect(reservation.loanDurationHours).toBe(8);
    expect(reservation.configurationSnapshot).toEqual(snapshot);
    await inventory.updateLoanPolicy(resourceId, 3);
    await inventory.replaceAccessories(resourceId, []);
    const picked = await reservations.pickup(reservation.id, new Date());
    expect(picked.loan.configurationSnapshot).toEqual(snapshot);
    expect(picked.loan.endsAt.getTime() - picked.loan.startsAt.getTime()).toBe(
      8 * 3600000,
    );
    expect(
      (await loans.findById(picked.loan.id))?.configurationSnapshot,
    ).toEqual(snapshot);
    const writes = db.calls.filter((p) => p.operation === 'update');
    expect(writes.some((p) => p.table === 'recursos')).toBe(true);
    expect(writes.some((p) => p.table === 'categorias_recurso')).toBe(true);
  });
  it.each([
    { individual: 3, categoryHours: 8, expected: 3, source: 'RESOURCE' },
    { individual: null, categoryHours: null, expected: 48, source: 'CATEGORY' },
  ])(
    'freezes effective policy and its provenance: $source / $expected hours',
    async ({ individual, categoryHours, expected, source }) => {
      db.rows('ejemplares')[0]!.estado = 'DISPONIBLE';
      db.rows('recursos')[0]!.duracionPrestamoHoras = individual;
      db.rows('categorias_recurso')[0]!.tiempoMaximoPrestamoHoras =
        categoryHours;
      const reservation = await reservations.create({
        userId,
        copyId,
        enforceSingleOpenOperation: false,
        requestedAt: past(),
        pickupDeadline: new Date(Date.now() + 60000),
        loanDurationHours: 999,
      });
      expect(reservation.configurationSnapshot?.policy).toMatchObject({
        durationHours: individual,
        effectiveDurationHours: expected,
        source,
      });
      db.rows('categorias_recurso')[0]!.tiempoMaximoPrestamoHoras = 1;
      const picked = await reservations.pickup(reservation.id, new Date());
      expect(
        picked.loan.endsAt.getTime() - picked.loan.startsAt.getTime(),
      ).toBe(expected * 3600000);
    },
  );
  it('returns via the existing HTTP operation, confirms persistence, and rejects duplicate effects', async () => {
    await inspect().expect(201);
    const result = await request(app.getHttpServer())
      .post(`/loans/${loanId}/return`)
      .auth(token(), { type: 'bearer' })
      .send({ returnedAt: new Date().toISOString() })
      .expect(201);
    expect(result.body.status).toBe('FINALIZADO');
    expect(result.body.return).toBeTruthy();
    expect(result.body.returnChecklist.actorId).toBe(actorId);
    await request(app.getHttpServer())
      .post(`/loans/${loanId}/return`)
      .auth(token(), { type: 'bearer' })
      .send({ returnedAt: new Date().toISOString() })
      .expect(409);
    expect(db.rows('devoluciones')).toHaveLength(1);
  });
  it('rolls back reserved copy/configuration on failed create; preserves legacy reservation duration on pickup', async () => {
    db.rows('ejemplares')[0]!.estado = 'DISPONIBLE';
    const runtime = db.client.runtime(),
      original = runtime.query.bind(runtime);
    const spy = vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
      if (plan.table === 'reservas' && plan.operation === 'insert')
        throw new Error('isolated insert failure');
      return original(plan);
    });
    await expect(
      reservations.create({
        userId,
        copyId,
        enforceSingleOpenOperation: false,
        requestedAt: past(),
        pickupDeadline: new Date(),
        loanDurationHours: 8,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.rows('ejemplares')[0]!.estado).toBe('DISPONIBLE');
    spy.mockRestore();
    db.rows('reservas')[1]!.fechaLimiteRecogida = Temporal.Instant.from(
      new Date(Date.now() + 60000).toISOString(),
    );
    db.rows('ejemplares')[1]!.estado = 'RESERVADO';
    const picked = await reservations.pickup(uuid(11), new Date());
    expect(picked.loan.configurationSnapshot).toBeNull();
    expect(picked.loan.endsAt.getTime() - picked.loan.startsAt.getTime()).toBe(
      4 * 3600000,
    );
  });
  it('does not report inspection success when storage fails', async () => {
    const runtime = db.client.runtime(),
      original = runtime.query.bind(runtime);
    vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
      if (
        plan.table === 'inspecciones_devolucion' &&
        plan.operation === 'insert'
      )
        throw new Error('isolated inspection failure');
      return original(plan);
    });
    await expect(
      loans.saveReturnChecklist({
        loanId,
        actorId,
        checkedAt: new Date(),
        parts: [{ accessoryId, received: true }],
      }),
    ).rejects.toThrow('isolated inspection failure');
    expect(db.rows('inspecciones_devolucion')).toHaveLength(0);
  });
  it('serializes concurrent retries in a transaction double; PostgreSQL locking remains untested', async () => {
    const original = db.client.transaction.bind(db.client);
    let queue: Promise<unknown> = Promise.resolve();
    db.client.transaction = (work) => {
      const result = queue.then(() => original(work));
      queue = result.catch(() => {});
      return result;
    };
    const data = {
      loanId,
      actorId,
      checkedAt: new Date(),
      parts: [{ accessoryId, received: true }],
    };
    const [a, b] = await Promise.all([
      loans.saveReturnChecklist(data),
      loans.saveReturnChecklist(data),
    ]);
    expect(a.id).toBe(b.id);
    expect(db.rows('inspecciones_devolucion')).toHaveLength(1);
    const returns = await Promise.allSettled([
      loans.registerReturnWithCopy({ loanId, returnedAt: new Date() }),
      loans.registerReturnWithCopy({ loanId, returnedAt: new Date() }),
    ]);
    expect(returns.map((r) => r.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(db.rows('devoluciones')).toHaveLength(1);
  });
  it('documents complete nested contracts and derives role/lock metadata for Showcase', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const schemas = doc.components!.schemas!;
    for (const [schema, properties] of [
      [
        'ReturnChecklistResponseDto',
        [
          'id',
          'loanId',
          'actorId',
          'checkedAt',
          'parts',
          'configurationSnapshot',
        ],
      ],
      [
        'CopyLoanSnapshotDto',
        ['schemaVersion', 'copyId', 'resourceId', 'policy', 'accessories'],
      ],
      ['ReservationsPageResponseDto', ['items', 'total', 'page', 'limit']],
      ['LoanHistoryPageResponseDto', ['items', 'total', 'page', 'limit']],
    ] as const)
      expect(
        Object.keys((schemas[schema] as SchemaObject).properties!),
      ).toEqual(expect.arrayContaining([...properties]));
    for (const name of ['resourceHistory', 'returnChecklist'] as const)
      expect(
        deriveAuthorization(LoansController, LoansController.prototype[name]),
      ).toMatchObject({
        'x-roles': [AccessRole.OPERATOR, AccessRole.ADMINISTRATOR],
      });
    expect(doc.paths['/loans/reservations']!.get!.parameters).toHaveLength(5);
    expect(
      doc.paths['/loans/{loanId}/return-checklist']!.post!.security,
    ).toEqual([{ bearer: [] }]);
  });
});

it('builds native ORM SQL plans for page/count filters without connecting to PostgreSQL', async () => {
  const builder = postgres({ contractJson });
  const query = vi.fn().mockResolvedValue([]);
  const prisma = {
    sql: builder.sql,
    client: { runtime: () => ({ query }) },
  } as unknown as PrismaService;
  await new PrismaReservationRepository(prisma).findMany({
    page: 1,
    limit: 20,
  });
  await new PrismaReservationRepository(prisma).findMany({
    page: 2,
    limit: 1,
    userId,
    copyId,
    status: 'CONFIRMADA' as any,
  });
  query
    .mockResolvedValueOnce([{ id: resourceId }])
    .mockResolvedValueOnce([{ id: copyId }]);
  await new PrismaLoanRepository(prisma).findResourceHistory(resourceId, {
    page: 1,
    limit: 10,
  });
  expect(
    query.mock.calls.every(([plan]) => plan.ast && plan.meta.lane === 'dsl'),
  ).toBe(true);
});
