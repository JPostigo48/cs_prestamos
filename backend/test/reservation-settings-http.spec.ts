import 'reflect-metadata';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Temporal } from 'temporal-polyfill/full';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationSettingsController } from '../src/modules/system/presentation/reservation-settings.controller.js';
import { PatchReservationSettingsDto } from '../src/modules/system/presentation/reservation-settings.dto.js';
import { ReservationSettingsRepository } from '../src/modules/system/domain/reservation-settings.repository.js';
import { PrismaReservationSettingsRepository } from '../src/modules/system/infrastructure/prisma-reservation-settings.repository.js';
import { AuthGuard } from '../src/modules/auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../src/modules/auth/presentation/guards/roles.guard.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';

vi.mock('dotenv/config', () => ({}));
const path = '/system/reservation-settings';
describe('Reservation settings HTTP, real repository/guards with DB and JWT doubles', () => {
  let app: INestApplication;
  let db: ReturnType<typeof inMemoryPrisma>;
  beforeEach(async () => {
    db = inMemoryPrisma({
      configuracion_reservas: [
        { id: 1, pickupWaitMinutes: 30, weeklySchedule: null, version: 1 },
      ],
    });
    db.rows('configuracion_reservas')[0].updatedAt = Temporal.Instant.from(
      '2026-11-01T00:00:00Z',
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [ReservationSettingsRepository],
      ReservationSettingsController,
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [PatchReservationSettingsDto, Object],
      ReservationSettingsController.prototype,
      'update',
    );
    const module = await Test.createTestingModule({
      controllers: [ReservationSettingsController],
      providers: [
        {
          provide: ReservationSettingsRepository,
          useValue: new PrismaReservationSettingsRepository(db as any),
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(
        new AuthGuard(
          {
            verify: (role: AccessRole) => ({
              accountId: role,
              userId: 'actor',
              role,
            }),
          } as any,
          {
            findById: async (role: AccessRole) => ({
              id: role,
              userId: 'actor',
              role,
              enabled: true,
            }),
          } as any,
        ),
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
    vi.restoreAllMocks();
  });
  const roles = [
    AccessRole.USER,
    AccessRole.OPERATOR,
    AccessRole.ADMINISTRATOR,
  ];
  it.each(roles)('GET authenticated %s', async (role) => {
    const response = await request(app.getHttpServer())
      .get(path)
      .auth(role, { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({
      pickupWaitMinutes: 30,
      weeklySchedule: null,
      version: 1,
      timeZone: 'America/Lima',
      scheduleStatus: 'UNCONFIGURED',
      warning: expect.any(String),
    });
  });
  it.each(roles)('PATCH permission %s', async (role) => {
    await request(app.getHttpServer())
      .patch(path)
      .auth(role, { type: 'bearer' })
      .send({ pickupWaitMinutes: 45 })
      .expect(role === AccessRole.ADMINISTRATOR ? 200 : 403);
    expect(db.rows('configuracion_reservas')[0].pickupWaitMinutes).toBe(
      role === AccessRole.ADMINISTRATOR ? 45 : 30,
    );
  });
  it('requires authentication for GET and PATCH', async () => {
    await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .patch(path)
      .send({ pickupWaitMinutes: 45 })
      .expect(401);
  });
  it('persists across repository instances, audits before/after and exposes configured state', async () => {
    const weeklySchedule = Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      intervals: [],
    }));
    const result = await request(app.getHttpServer())
      .patch(path)
      .auth(AccessRole.ADMINISTRATOR, { type: 'bearer' })
      .send({ pickupWaitMinutes: 75, weeklySchedule })
      .expect(200);
    const repository = new PrismaReservationSettingsRepository(db as any);
    expect(await repository.read()).toMatchObject({
      pickupWaitMinutes: 75,
      weeklySchedule,
      version: 2,
    });
    expect(result.body).toMatchObject({
      scheduleStatus: 'CONFIGURED',
      warning: null,
    });
    expect(
      JSON.parse(db.rows('auditorias_usuario')[0].datosAnteriores)
        .pickupWaitMinutes,
    ).toBe(30);
    expect(
      JSON.parse(db.rows('auditorias_usuario')[0].datosNuevos).actor,
    ).toEqual({ userId: 'actor', accountId: AccessRole.ADMINISTRATOR });
  });
  it.each([
    {},
    { pickupWaitMinutes: null },
    { pickupWaitMinutes: 0 },
    { pickupWaitMinutes: 241 },
    { pickupWaitMinutes: 1.5 },
    { weeklySchedule: [] },
    { otherSetting: 3 },
  ])('invalid PATCH %# never writes', async (body) => {
    await request(app.getHttpServer())
      .patch(path)
      .auth(AccessRole.ADMINISTRATOR, { type: 'bearer' })
      .send(body)
      .expect(400);
    expect(db.rows('configuracion_reservas')[0].version).toBe(1);
    expect(db.rows('auditorias_usuario')).toHaveLength(0);
  });
  it('returns 503 for missing row, not a fake persisted default or PATCH success', async () => {
    db.rows('configuracion_reservas').splice(0);
    for (const method of ['get', 'patch'] as const) {
      const response = await request(app.getHttpServer())
        [method](path)
        .auth(AccessRole.ADMINISTRATOR, { type: 'bearer' })
        .send(method === 'patch' ? { pickupWaitMinutes: 40 } : undefined)
        .expect(503);
      expect(response.body.message).toContain('migración pendiente');
    }
    expect(db.rows('configuracion_reservas')).toHaveLength(0);
  });
  it('missing-table driver failure is controlled 503 and never leaks SQL', async () => {
    vi.spyOn(db.client.runtime(), 'query').mockRejectedValue(
      Object.assign(new Error('SQL secret internal query'), { code: '42P01' }),
    );
    for (const method of ['get', 'patch'] as const) {
      const response = await request(app.getHttpServer())
        [method](path)
        .auth(AccessRole.ADMINISTRATOR, { type: 'bearer' })
        .send(method === 'patch' ? { pickupWaitMinutes: 40 } : undefined)
        .expect(503);
      expect(JSON.stringify(response.body)).not.toContain('SQL secret');
    }
  });
  it('audit failure rolls back the setting; no false success', async () => {
    db.failAudit();
    await request(app.getHttpServer())
      .patch(path)
      .auth(AccessRole.ADMINISTRATOR, { type: 'bearer' })
      .send({ pickupWaitMinutes: 40 })
      .expect(503);
    expect(db.rows('configuracion_reservas')[0]).toMatchObject({
      pickupWaitMinutes: 30,
      version: 1,
    });
  });
  it('single-field PATCH preserves other fields; explicit null unconfigures the schedule', async () => {
    const weeklySchedule = Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      intervals: [],
    }));
    const edit = (body: object) =>
      request(app.getHttpServer())
        .patch(path)
        .auth(AccessRole.ADMINISTRATOR, { type: 'bearer' })
        .send(body);
    await edit({ weeklySchedule }).expect(200);
    await edit({ pickupWaitMinutes: 60 }).expect(200);
    expect(db.rows('configuracion_reservas')[0]).toMatchObject({
      pickupWaitMinutes: 60,
      weeklySchedule,
      version: 3,
    });
    const cleared = await edit({ weeklySchedule: null }).expect(200);
    expect(cleared.body).toMatchObject({
      pickupWaitMinutes: 60,
      weeklySchedule: null,
      scheduleStatus: 'UNCONFIGURED',
      version: 4,
    });
    const lock = db.calls.findIndex(
      (p) => p.operation === 'lock' && p.text?.includes('FOR UPDATE'),
    );
    const write = db.calls.findIndex(
      (p) => p.table === 'configuracion_reservas' && p.operation === 'update',
    );
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(write).toBeGreaterThan(lock);
  });
});
