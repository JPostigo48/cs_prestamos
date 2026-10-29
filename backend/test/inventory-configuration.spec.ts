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
import { InventoryService } from '../src/modules/inventory/application/use-cases/inventory.service.js';
import { PrismaInventoryRepository } from '../src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.js';
import { InventoryController } from '../src/modules/inventory/presentation/controllers/inventory.controller.js';
import {
  ReplaceResourceAccessoriesDto,
  UpdateResourceLoanPolicyDto,
} from '../src/modules/inventory/presentation/dto/resource-configuration.dto.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';
import { JwtTokenAdapter } from '../src/modules/auth/infrastructure/security/jwt-token.adapter.js';
import { AuthGuard } from '../src/modules/auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../src/modules/auth/presentation/guards/roles.guard.js';
import { deriveAuthorization } from '../src/shared/presentation/openapi/authorization-metadata.js';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';

vi.mock('dotenv/config', () => ({}));
const resourceId = '123e4567-e89b-42d3-a456-426614174001';
const categoryId = '123e4567-e89b-42d3-a456-426614174002';
const copyId = '123e4567-e89b-42d3-a456-426614174003';
const missingId = '123e4567-e89b-42d3-a456-426614174004';
const userId = '123e4567-e89b-42d3-a456-426614174005';
const base = `/inventory/resources/${resourceId}`;

describe('F06/F07/F13 HTTP + production repository with isolated in-memory SQL/transaction harness (not PostgreSQL)', () => {
  let app: INestApplication;
  let db: ReturnType<typeof inMemoryPrisma>;
  let service: InventoryService;
  let jwt: JwtTokenAdapter;
  const accountState = { enabled: true };

  beforeEach(async () => {
    vi.stubEnv('JWT_SECRET', 'isolated-inventory-tests-only');
    vi.stubEnv('JWT_EXPIRES_IN', '3600s');
    db = inMemoryPrisma({
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
      ejemplares: [
        {
          id: copyId,
          recursoId: resourceId,
          codigoInventario: 'TEST-1',
          estado: 'DISPONIBLE',
        },
      ],
      reservas: [
        {
          id: 'historical-reservation',
          ejemplarId: copyId,
          duracionPrestamoHoras: 8,
        },
      ],
      prestamos: [
        {
          id: 'historical-loan',
          ejemplarId: copyId,
          fechaFin: '2026-10-30T18:00:00Z',
        },
      ],
    });
    service = new InventoryService(
      new PrismaInventoryRepository(db as unknown as PrismaService),
    );
    jwt = new JwtTokenAdapter();
    accountState.enabled = true;
    const accounts = {
      findById: async (id: string) => ({
        id,
        userId,
        enabled: accountState.enabled,
        role: id as AccessRole,
      }),
    };
    Reflect.defineMetadata(
      'design:paramtypes',
      [InventoryService],
      InventoryController,
    );
    for (const [method, params] of [
      ['getAccessories', [String]],
      ['replaceAccessories', [String, ReplaceResourceAccessoriesDto, Object]],
      ['updateLoanPolicy', [String, UpdateResourceLoanPolicyDto, Object]],
    ] as const)
      Reflect.defineMetadata(
        'design:paramtypes',
        params,
        InventoryController.prototype,
        method,
      );
    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue(new AuthGuard(jwt, accounts as any))
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
  const token = (role = AccessRole.ADMINISTRATOR) =>
    jwt.sign({ accountId: role, userId, role, userType: 'ESTUDIANTE' });
  const put = (items: unknown) =>
    request(app.getHttpServer())
      .put(base + '/accessories')
      .auth(token(), { type: 'bearer' })
      .send({ items });
  const patch = (durationHours: unknown) =>
    request(app.getHttpServer())
      .patch(base + '/loan-policy')
      .auth(token(), { type: 'bearer' })
      .send({ durationHours });

  it('requires a valid signed JWT, current account and administrator for both mutations; all authenticated roles can read', async () => {
    for (const method of ['get', 'put', 'patch'] as const) {
      const url = base + (method === 'patch' ? '/loan-policy' : '/accessories');
      await request(app.getHttpServer())[method](url).expect(401);
      await request(app.getHttpServer())
        [method](url)
        .auth('tampered.jwt', { type: 'bearer' })
        .expect(401);
    }
    for (const role of Object.values(AccessRole)) {
      await request(app.getHttpServer())
        .get(base + '/accessories')
        .auth(token(role), { type: 'bearer' })
        .expect(200, { items: [] });
      const status = role === AccessRole.ADMINISTRATOR ? 200 : 403;
      await request(app.getHttpServer())
        .put(base + '/accessories')
        .auth(token(role), { type: 'bearer' })
        .send({ items: [] })
        .expect(status);
      await request(app.getHttpServer())
        .patch(base + '/loan-policy')
        .auth(token(role), { type: 'bearer' })
        .send({ durationHours: 4 })
        .expect(status);
    }
    accountState.enabled = false;
    await request(app.getHttpServer())
      .get(base + '/accessories')
      .auth(token(), { type: 'bearer' })
      .expect(401);
  });

  it('validates nested DTOs, UUIDs, explicit nulls, names, uniqueness and array limits without writes', async () => {
    for (const items of [
      null,
      {},
      [null],
      [{ nombre: '' }],
      [{ nombre: '   ' }],
      [{ nombre: 4 }],
      [{ nombre: 'a'.repeat(121) }],
      [{ id: null, nombre: 'A' }],
      [{ id: 'wrong', nombre: 'A' }],
      [{ nombre: 'A', active: true }],
      [{ nombre: 'Cable' }, { nombre: ' cable ' }],
      Array.from({ length: 101 }, (_, i) => ({ nombre: String(i) })),
    ])
      await put(items).expect(400);
    const id = missingId;
    await put([
      { id, nombre: 'A' },
      { id, nombre: 'B' },
    ]).expect(400);
    for (const hours of [0, -1, 1.5, '8', 2147483648, {}, []])
      await patch(hours).expect(400);
    await request(app.getHttpServer())
      .patch(base + '/loan-policy')
      .auth(token(), { type: 'bearer' })
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .put(base + '/accessories')
      .auth(token(), { type: 'bearer' })
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .get('/inventory/resources/not-a-uuid/accessories')
      .auth(token(), { type: 'bearer' })
      .expect(400);
    expect(db.rows('accesorios_recurso')).toEqual([]);
    expect(db.rows('auditorias_usuario')).toEqual([]);
  });

  it('persists through the real repository, preserves IDs on replace/rename/reactivation and does not mutate historical snapshots', async () => {
    const created = (
      await put([{ nombre: ' Cargador ' }, { nombre: 'Cable' }]).expect(200)
    ).body.items;
    const charger = created.find((item: any) => item.nombre === 'Cargador');
    expect(charger.id).toMatch(/^[0-9a-f-]{36}$/);
    const snapshot = await service.getCopyLoanSnapshot(copyId);
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      resourceId,
      copyId,
      policy: { source: 'CATEGORY', effectiveDurationHours: 8 },
    });
    await put([{ id: charger.id, nombre: 'Adaptador' }]).expect(200, {
      items: [{ id: charger.id, nombre: 'Adaptador' }],
    });
    expect((await service.getAccessories(resourceId)).items).toEqual([
      { id: charger.id, nombre: 'Adaptador' },
    ]);
    expect(db.rows('accesorios_recurso')).toHaveLength(2);
    expect(
      db.rows('accesorios_recurso').filter((row) => !row.activo),
    ).toHaveLength(1);
    await put([]).expect(200, { items: [] });
    await put([{ nombre: 'adaptador' }]).expect(200, {
      items: [{ id: charger.id, nombre: 'adaptador' }],
    });
    expect(snapshot.accessories).toContainEqual({
      id: charger.id,
      nombre: 'Cargador',
    });
    expect(snapshot.accessories).toHaveLength(2);
    const audit = db.rows('auditorias_usuario').at(-1)!;
    expect(audit).toMatchObject({
      usuarioId: userId,
      accion: 'INVENTARIO_ACCESORIOS_EDITADOS',
    });
  });

  it('does not confuse copy and resource IDs; refuses foreign IDs and preserves existing data', async () => {
    await put([{ nombre: 'Cable' }]).expect(200);
    const previous = await service.getAccessories(resourceId);
    await put([{ id: missingId, nombre: 'Intruso' }]).expect(404);
    await request(app.getHttpServer())
      .get(`/inventory/resources/${copyId}/accessories`)
      .auth(token(), { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/inventory/resources/${missingId}/loan-policy`)
      .auth(token(), { type: 'bearer' })
      .send({ durationHours: 4 })
      .expect(404);
    expect(await service.getAccessories(resourceId)).toEqual(previous);
  });

  it('rolls back conflicting stable-ID renames and audit failures, including duration writes', async () => {
    const items = (await put([{ nombre: 'A' }, { nombre: 'B' }])).body.items;
    await put([{ id: items[0].id, nombre: 'B' }]).expect(409);
    expect((await service.getAccessories(resourceId)).items).toHaveLength(2);
    db.failAudit();
    await put([]).expect(500);
    expect((await service.getAccessories(resourceId)).items).toHaveLength(2);
    await patch(12).expect(500);
    expect(db.rows('recursos')[0].duracionPrestamoHoras).toBeNull();
  });

  it('exposes individual effective hours, reset and fallback without changing category, rules or past operations', async () => {
    const pastReservations = structuredClone(db.rows('reservas'));
    const pastLoans = structuredClone(db.rows('prestamos'));
    await patch(3).expect(200, {
      resourceId,
      categoryId,
      durationHours: 3,
      effectiveDurationHours: 3,
      source: 'RESOURCE',
    });
    expect(await service.getLoanAvailability(copyId)).toMatchObject({
      maximumLoanHours: 3,
      maximumLoanDays: 3 / 24,
    });
    expect((await service.getResource(resourceId)).loanPolicy).toMatchObject({
      durationHours: 3,
      effectiveDurationHours: 3,
    });
    expect((await service.listResources()).data[0].durationHours).toBe(3);
    const snapshot = await service.getCopyLoanSnapshot(copyId);
    await patch(null).expect(200, {
      resourceId,
      categoryId,
      durationHours: null,
      effectiveDurationHours: 8,
      source: 'CATEGORY',
    });
    db.rows('categorias_recurso')[0].tiempoMaximoPrestamoHoras = null;
    expect(await service.getLoanAvailability(copyId)).toMatchObject({
      maximumLoanHours: 48,
    });
    expect(snapshot.policy.effectiveDurationHours).toBe(3);
    expect(db.rows('reservas')).toEqual(pastReservations);
    expect(db.rows('prestamos')).toEqual(pastLoans);
    expect(db.rows('versiones_regla')).toEqual([]);
  });

  it('documents live routes, nested arrays, nullable effective duration, auth and exact role metadata', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const accessory =
      document.paths['/inventory/resources/{resourceId}/accessories'];
    const policy =
      document.paths['/inventory/resources/{resourceId}/loan-policy'].patch!;
    expect(accessory.get!.security).toEqual([{ bearer: [] }]);
    expect(
      deriveAuthorization(
        InventoryController,
        InventoryController.prototype.replaceAccessories,
      )['x-roles'],
    ).toEqual([AccessRole.ADMINISTRATOR]);
    expect(
      deriveAuthorization(
        InventoryController,
        InventoryController.prototype.updateLoanPolicy,
      )['x-roles'],
    ).toEqual([AccessRole.ADMINISTRATOR]);
    expect(
      deriveAuthorization(
        InventoryController,
        InventoryController.prototype.getAccessories,
      )['x-roles'],
    ).toEqual([AccessRole.USER, AccessRole.OPERATOR, AccessRole.ADMINISTRATOR]);
    expect(Object.keys(policy.responses)).toEqual(
      expect.arrayContaining(['200', '400', '401', '403', '404', '409', '500']),
    );
    const schemas = document.components!.schemas!;
    const items = (schemas.ResourceAccessoriesResponseDto as SchemaObject)
      .properties!.items as SchemaObject;
    expect(items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/ResourceAccessoryResponseDto' },
    });
    expect(
      (schemas.UpdateResourceLoanPolicyDto as SchemaObject).properties!
        .durationHours,
    ).toMatchObject({ type: 'integer', nullable: true, minimum: 1 });
    expect(
      (schemas.UpdateResourceLoanPolicyDto as SchemaObject).required,
    ).toContain('durationHours');
    expect(
      (schemas.ResourceLoanPolicyResponseDto as SchemaObject).properties!
        .effectiveDurationHours,
    ).toMatchObject({ type: 'integer' });
    expect(
      (schemas.ResourceDetailResponseDto as SchemaObject).properties!
        .loanPolicy,
    ).toBeDefined();
  });
});
