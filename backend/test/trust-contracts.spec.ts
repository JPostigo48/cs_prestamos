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
import postgres from '@prisma/orm-postgres/runtime';
import { Temporal } from 'temporal-polyfill/full';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import contractJson from '../prisma/contract.json' with { type: 'json' };
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';
import { SanctionsController } from '../src/modules/rules/presentation/controllers/sanctions.controller.js';
import {
  AppealsQueryDto,
  LiftSanctionDto,
  SuspendUserDto,
} from '../src/modules/rules/presentation/dto/sanction.dto.js';
import { ManageSanctionsUseCase } from '../src/modules/rules/application/use-cases/manage-sanctions.use-case.js';
import { PrismaSanctionRepository } from '../src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.js';
import { PrismaAppealRepository } from '../src/modules/rules/infrastructure/persistence/prisma/prisma-appeal.repository.js';
import { PrismaUserRepository } from '../src/modules/users/infrastructure/persistence/prisma/prisma-user.repository.js';
import { PrismaReservationRepository } from '../src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.js';
import { effectiveSanctionStatus } from '../src/modules/rules/domain/entities/sanction-schedule.js';
import {
  OFFICIAL_POLICIES,
  describeOfficialPolicy,
} from '../src/modules/rules/domain/official-policy.catalog.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';
import { JwtTokenAdapter } from '../src/modules/auth/infrastructure/security/jwt-token.adapter.js';
import { AuthGuard } from '../src/modules/auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../src/modules/auth/presentation/guards/roles.guard.js';
import { deriveAuthorization } from '../src/shared/presentation/openapi/authorization-metadata.js';
import { AppealStatus } from '../src/modules/rules/domain/entities/appeal.js';

vi.mock('dotenv/config', () => ({}));
const uuid = (n: number) =>
  `123e4567-e89b-42d3-a456-${String(n).padStart(12, '0')}`;
const userId = uuid(1),
  otherUser = uuid(2),
  actorId = uuid(3),
  accountId = uuid(4),
  copyId = uuid(5),
  loanCopy = uuid(6),
  loanId = uuid(7),
  reservationId = uuid(8),
  oldSanction = uuid(9),
  otherSanction = uuid(10);
const temporary = OFFICIAL_POLICIES.find(
  (p) => p.kind === 'DAMAGE' && p.suspensionType === 'TEMPORAL',
)!;
const indefinite = OFFICIAL_POLICIES.find(
  (p) => p.kind === 'DAMAGE' && p.trustEffect === 'SET_ZERO',
)!;
const instant = (offset = 0) =>
  Temporal.Instant.fromEpochMilliseconds(Date.now() + offset);
const actor = { accountId, userId: actorId };
const suspension = (extra: object = {}) => ({
  ruleId: temporary.ruleId,
  reason: 'Daño constatado y fundamentado',
  requestId: uuid(100),
  ...extra,
});

describe('F04/F05/F11/F12 HTTP and production repositories; isolated in-memory transactions, NOT PostgreSQL', () => {
  let app: INestApplication,
    db: ReturnType<typeof inMemoryPrisma>,
    repo: PrismaSanctionRepository,
    jwt: JwtTokenAdapter;
  let enabled = true;
  beforeEach(async () => {
    vi.stubEnv('JWT_SECRET', 'isolated-trust-contract-tests-only');
    vi.stubEnv('JWT_EXPIRES_IN', '3600s');
    enabled = true;
    db = inMemoryPrisma({
      usuarios: [userId, otherUser, actorId].map((id) => ({
        id,
        nombre: id,
        tipoUsuario: 'ESTUDIANTE',
        identificadorInstitucional: id,
        vinculacionVigente: true,
        confianza: '75.00',
      })),
      cuentas_acceso: [
        {
          id: accountId,
          usuarioId: actorId,
          rol: 'ADMINISTRADOR',
          habilitada: true,
        },
      ],
      reglas_uso: OFFICIAL_POLICIES.map((p) => ({
        id: p.ruleId,
        versionVigenteId: p.versionId,
      })),
      versiones_regla: OFFICIAL_POLICIES.map((p) => ({
        id: p.versionId,
        reglaId: p.ruleId,
        numero: p.version,
        titulo: p.title,
        descripcion: describeOfficialPolicy(p, p.category ? uuid(30) : null),
        penalizacionPorcentual: p.penalty.toFixed(2),
        consecuencia: p.consequence,
        tipoSuspension: p.suspensionType,
        diasSuspension: p.suspensionDays,
        estado: 'ACTIVA',
      })),
      ejemplares: [
        { id: copyId, recursoId: uuid(30), estado: 'RESERVADO' },
        { id: loanCopy, recursoId: uuid(30), estado: 'PRESTADO' },
      ],
      prestamos: [
        {
          id: loanId,
          usuarioId: userId,
          ejemplarId: loanCopy,
          reservaId: uuid(70),
          estado: 'ACTIVO',
        },
      ],
      reservas: [
        {
          id: reservationId,
          usuarioId: userId,
          ejemplarId: copyId,
          estado: 'CONFIRMADA',
          fechaSolicitada: new Date(Date.now() - 60000),
          fechaLimiteRecogida: new Date(Date.now() + 600000),
          fechaRecogida: null,
          fechaCancelacion: null,
          motivoCancelacion: null,
          duracionPrestamoHoras: 8,
          configurationSnapshot: null,
        },
      ],
      sanciones: [
        {
          id: oldSanction,
          usuarioId: userId,
          incumplimientoId: uuid(20),
          reglaId: temporary.ruleId,
          versionReglaId: temporary.versionId,
          estado: 'FINALIZADA',
          fechaInicio: new Date(Date.now() - 86400000),
          fechaFin: new Date(Date.now() - 60000),
          confianzaAnterior: '85.00',
          confianzaPosterior: '75.00',
        },
        {
          id: otherSanction,
          usuarioId: otherUser,
          incumplimientoId: uuid(21),
          reglaId: null,
          versionReglaId: null,
          estado: 'FINALIZADA',
          fechaInicio: new Date(Date.now() - 86400000),
          fechaFin: new Date(Date.now() - 60000),
          confianzaAnterior: '85.00',
          confianzaPosterior: '75.00',
        },
      ],
      apelaciones: [
        {
          id: uuid(40),
          usuarioId: userId,
          incumplimientoId: uuid(20),
          sancionId: oldSanction,
          motivo: 'Propia pendiente',
          fecha: new Date(Date.now() - 2000),
          estado: 'PENDIENTE',
          resolucion: null,
          fechaResolucion: null,
          resueltaPorCuentaId: null,
        },
        {
          id: uuid(41),
          usuarioId: userId,
          incumplimientoId: uuid(22),
          sancionId: uuid(11),
          motivo: 'Propia resuelta',
          fecha: new Date(Date.now() - 1000),
          estado: 'RECHAZADA',
          resolucion: 'Fundamento',
          fechaResolucion: new Date(),
          resueltaPorCuentaId: accountId,
        },
        {
          id: uuid(42),
          usuarioId: otherUser,
          incumplimientoId: uuid(21),
          sancionId: otherSanction,
          motivo: 'Ajena',
          fecha: new Date(),
          estado: 'PENDIENTE',
          resolucion: null,
          fechaResolucion: null,
          resueltaPorCuentaId: null,
        },
      ],
    });
    for (const table of ['reservas', 'sanciones', 'apelaciones'])
      for (const row of db.rows(table))
        for (const [key, value] of Object.entries(row))
          if (value instanceof Date)
            row[key] = Temporal.Instant.from(value.toISOString());
    repo = new PrismaSanctionRepository(db as unknown as PrismaService);
    jwt = new JwtTokenAdapter();
    Reflect.defineMetadata(
      'design:paramtypes',
      [ManageSanctionsUseCase],
      SanctionsController,
    );
    for (const [name, types] of [
      ['list', [AppealsQueryDto, Object]],
      ['detail', [String, Object]],
      ['suspend', [String, SuspendUserDto, Object]],
      ['lift', [String, LiftSanctionDto, Object]],
    ] as const)
      Reflect.defineMetadata(
        'design:paramtypes',
        types,
        SanctionsController.prototype,
        name,
      );
    const module = await Test.createTestingModule({
      controllers: [SanctionsController],
      providers: [
        {
          provide: ManageSanctionsUseCase,
          useValue: new ManageSanctionsUseCase(repo),
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(
        new AuthGuard(jwt, {
          findById: async (id: string) => ({
            id,
            userId: id === uuid(50) ? userId : actorId,
            role:
              id === uuid(50)
                ? AccessRole.USER
                : id === uuid(51)
                  ? AccessRole.OPERATOR
                  : AccessRole.ADMINISTRATOR,
            enabled,
          }),
        } as any),
      )
      .overrideGuard(RolesGuard)
      .useValue(new RolesGuard(new Reflector()))
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
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
    vi.unstubAllEnvs();
  });
  const token = (role: AccessRole) =>
    jwt.sign({
      accountId:
        role === AccessRole.USER
          ? uuid(50)
          : role === AccessRole.OPERATOR
            ? uuid(51)
            : accountId,
      userId: role === AccessRole.USER ? userId : actorId,
      role,
      userType: 'ESTUDIANTE',
    });
  const get = (path: string, role = AccessRole.ADMINISTRATOR) =>
    request(app.getHttpServer())
      .get(path)
      .auth(token(role), { type: 'bearer' });
  const post = (path: string, body: object, role = AccessRole.ADMINISTRATOR) =>
    request(app.getHttpServer())
      .post(path)
      .auth(token(role), { type: 'bearer' })
      .send(body);
  const suspend = (
    body: object = suspension(),
    role = AccessRole.ADMINISTRATOR,
  ) => post(`/users/${userId}/suspensions`, body, role);
  const lift = (id: string, resolution = 'Resolución interna acreditada') =>
    post(`/sanctions/${id}/lift`, { resolution });

  it('requires a valid JWT and enabled current account on every new route', async () => {
    for (const path of ['/appeals', `/sanctions/${oldSanction}`]) {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer())
        .get(path)
        .auth('invalid', { type: 'bearer' })
        .expect(401);
      enabled = false;
      await get(path).expect(401);
      enabled = true;
    }
    for (const path of [
      `/users/${userId}/suspensions`,
      `/sanctions/${oldSanction}/lift`,
    ])
      await request(app.getHttpServer()).post(path).send({}).expect(401);
  });
  it('enforces USUARIO ownership server-side before pagination and allows staff queries', async () => {
    const own = await get('/appeals?limit=1&page=2', AccessRole.USER).expect(
      200,
    );
    expect(own.body).toMatchObject({ total: 2, page: 2, limit: 1 });
    expect(own.body.items).toHaveLength(1);
    expect(own.body.items[0].userId).toBe(userId);
    await get(`/appeals?userId=${otherUser}`, AccessRole.USER).expect(403);
    expect(
      (
        await get(
          `/appeals?sanctionId=${otherSanction}`,
          AccessRole.USER,
        ).expect(200)
      ).body.total,
    ).toBe(0);
    await get(`/sanctions/${otherSanction}`, AccessRole.USER).expect(403);
    await get(`/sanctions/${oldSanction}`, AccessRole.USER).expect(200);
    for (const role of [AccessRole.OPERATOR, AccessRole.ADMINISTRATOR]) {
      const result = await get(
        `/appeals?userId=${otherUser}&status=PENDIENTE&sanctionId=${otherSanction}`,
        role,
      ).expect(200);
      expect(result.body.total).toBe(1);
      expect(result.body.items[0].userId).toBe(otherUser);
      await get(`/sanctions/${otherSanction}`, role).expect(200);
    }
  });
  it('denies mutations to both USUARIO and OPERADOR without writing anything', async () => {
    for (const role of [AccessRole.USER, AccessRole.OPERATOR]) {
      await suspend(suspension(), role).expect(403);
      await post(
        `/sanctions/${oldSanction}/lift`,
        { resolution: 'Motivo' },
        role,
      ).expect(403);
    }
    expect(db.rows('usuarios')[0]!.confianza).toBe('75.00');
    expect(db.rows('sanciones')).toHaveLength(2);
  });
  it.each([
    'page=0',
    'page=1.5',
    'page=1000001',
    'limit=0',
    'limit=101',
    'userId=no',
    'sanctionId=no',
    'status=OTRA',
    'extra=1',
    'page[]=1',
  ])('validates query %s', async (query) => {
    await get('/appeals?' + query).expect(400);
  });
  it('rejects bad UUIDs, whitespace, spoofed actor, unsupported fields and invalid dates', async () => {
    await get('/sanctions/no').expect(400);
    await get(`/sanctions/${uuid(999)}`).expect(404);
    for (const body of [
      suspension({ ruleId: 'no' }),
      suspension({ requestId: 'no' }),
      suspension({ reason: ' ' }),
      suspension({ reason: 'x'.repeat(2001) }),
      suspension({ actorId: uuid(99) }),
      suspension({ startsAt: '2026-02-30T00:00:00Z' }),
      suspension({ startsAt: '2027-01-01T00:00:00' }),
      suspension({ endsAt: 'bad' }),
      suspension({ startsAt: '2020-01-01T00:00:00Z' }),
      suspension({ endsAt: null }),
    ])
      await suspend(body).expect(400);
    await post('/users/no/suspensions', suspension()).expect(400);
    await post(`/users/${uuid(999)}/suspensions`, suspension()).expect(404);
    await suspend(suspension({ ruleId: uuid(999) })).expect(404);
    await post(`/sanctions/${oldSanction}/lift`, { resolution: ' ' }).expect(
      400,
    );
    await post(`/sanctions/${oldSanction}/lift`, {
      resolution: 'x'.repeat(2001),
    }).expect(400);
    expect(db.rows('sanciones')).toHaveLength(2);
  });
  it('persists exact version, policy penalty, actor/reason/calendar and cancels only reservations, preserving active loans and login', async () => {
    const response = await suspend().expect(201),
      result = response.body;
    expect(result).toMatchObject({
      userId,
      ruleId: temporary.ruleId,
      ruleVersionId: temporary.versionId,
      previousTrust: 75,
      resultingTrust: 75 - temporary.penalty,
      reason: suspension().reason,
      status: 'ACTIVA',
      rule: {
        id: temporary.versionId,
        suspensionDays: temporary.suspensionDays,
      },
      violation: { appliedPenalty: temporary.penalty },
    });
    expect(Date.parse(result.endsAt) - Date.parse(result.startsAt)).toBe(
      temporary.suspensionDays! * 86400000,
    );
    expect(result.history).toContainEqual(
      expect.objectContaining({
        action: 'SUSPENSION_REGISTRADA',
        actorAccountId: accountId,
        reason: suspension().reason,
      }),
    );
    expect(db.rows('reservas')[0]).toMatchObject({ estado: 'CANCELADA' });
    expect(db.rows('ejemplares').map((r) => r.estado)).toEqual([
      'DISPONIBLE',
      'PRESTADO',
    ]);
    expect(db.rows('prestamos')[0]).toMatchObject({
      id: loanId,
      estado: 'ACTIVO',
    });
    expect(db.rows('cuentas_acceso')[0]!.habilitada).toBe(true);
    expect(
      (
        await new PrismaUserRepository(
          db as unknown as PrismaService,
        ).getLoanEligibility(userId)
      ).eligible,
    ).toBe(false);
    const rule = db.rows('reglas_uso').find((r) => r.id === temporary.ruleId)!;
    rule.versionVigenteId = uuid(900);
    const detail = await get(`/sanctions/${result.id}`, AccessRole.USER).expect(
      200,
    );
    expect(detail.body.rule.id).toBe(temporary.versionId);
    expect(detail.body.ruleVersionId).toBe(temporary.versionId);
  });
  it('never infers legacy reason, version, violation or unknown audit actor', async () => {
    const result = await get(`/sanctions/${otherSanction}`).expect(200);
    expect(result.body).toMatchObject({
      reason: null,
      rule: null,
      violation: null,
      history: [],
    });
    expect(result.body.appeals[0].submittedAt).toMatch(/Z$/);
  });
  it('is idempotent by requestId; conflicting contents roll back without double penalty', async () => {
    const first = await suspend().expect(201),
      second = await suspend().expect(201);
    expect(second.body.id).toBe(first.body.id);
    expect(db.rows('usuarios')[0]!.confianza).toBe(
      (75 - temporary.penalty).toFixed(2),
    );
    expect(db.rows('incumplimientos')).toHaveLength(1);
    await suspend(suspension({ reason: 'Otro motivo' })).expect(409);
    expect(db.rows('sanciones')).toHaveLength(3);
  });
  it('serializes concurrent duplicate submissions in the transaction harness (not PostgreSQL locking)', async () => {
    const original = db.client.transaction.bind(db.client);
    let queue: Promise<unknown> = Promise.resolve();
    db.client.transaction = (work) => {
      const result = queue.then(() => original(work));
      queue = result.catch(() => {});
      return result;
    };
    const data = { ...suspension(), userId, actor };
    const [first, second] = await Promise.all([
      repo.suspend(data),
      repo.suspend(data),
    ]);
    expect(first.id).toBe(second.id);
    expect(db.rows('incumplimientos')).toHaveLength(1);
  });
  it('rolls back sanction, trust, history and reservation/copy changes if audit fails', async () => {
    db.failAudit();
    await expect(
      repo.suspend({ ...suspension(), userId, actor }),
    ).rejects.toThrow('audit unavailable');
    expect(db.rows('sanciones')).toHaveLength(2);
    expect(db.rows('incumplimientos')).toHaveLength(0);
    expect(db.rows('usuarios')[0]!.confianza).toBe('75.00');
    expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
    expect(db.rows('ejemplares')[0]!.estado).toBe('RESERVADO');
  });
  it('rolls back rather than freeing a loaned or inconsistent reserved copy', async () => {
    db.rows('ejemplares')[0]!.estado = 'PRESTADO';
    await suspend().expect(409);
    expect(db.rows('sanciones')).toHaveLength(2);
    expect(db.rows('usuarios')[0]!.confianza).toBe('75.00');
    expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
    expect(db.rows('ejemplares')[0]!.estado).toBe('PRESTADO');
    db.rows('ejemplares')[0]!.estado = 'RESERVADO';
    db.rows('prestamos')[0]!.ejemplarId = copyId;
    await suspend().expect(409);
    expect(db.rows('ejemplares')[0]!.estado).toBe('RESERVADO');
  });
  it('rejects automatic/access/reward/trust policies and unconfigured or inactive suspensions', async () => {
    for (const policy of OFFICIAL_POLICIES.filter(
      (p) => !['DAMAGE', 'LOSS'].includes(p.kind),
    ))
      await suspend(suspension({ ruleId: policy.ruleId })).expect(409);
    const version = db
      .rows('versiones_regla')
      .find((r) => r.id === temporary.versionId)!;
    version.estado = 'INACTIVA';
    await suspend().expect(404);
    const restoredVersion = db
      .rows('versiones_regla')
      .find((r) => r.id === temporary.versionId)!;
    restoredVersion.estado = 'ACTIVA';
    restoredVersion.tipoSuspension = null;
    await suspend().expect(409);
    expect(db.rows('incumplimientos')).toHaveLength(0);
  });
  it('lifts indefinite SET_ZERO without absolution or trust restoration, and is repeatable without duplicate audit', async () => {
    const first = await suspend(
      suspension({ ruleId: indefinite.ruleId }),
    ).expect(201);
    expect(first.body.endsAt).toBeNull();
    expect(first.body.resultingTrust).toBe(0);
    const result = await lift(first.body.id).expect(200);
    expect(result.body.status).toBe('FINALIZADA');
    expect(result.body.endsAt).not.toBeNull();
    expect(result.body.resultingTrust).toBe(0);
    expect(db.rows('usuarios')[0]!.confianza).toBe('0.00');
    const users = new PrismaUserRepository(db as unknown as PrismaService);
    expect((await users.getLoanEligibility(userId)).eligible).toBe(true);
    expect(
      (await new PrismaAppealRepository(
        db as unknown as PrismaService,
      ).findSanctionById(first.body.id))!.status,
    ).toBe('FINALIZADA');
    expect(
      effectiveSanctionStatus(
        { status: 'FINALIZADA', startsAt: new Date(), endsAt: null },
        new Date(Date.now() + 86400000),
      ),
    ).toBe('FINALIZADA');
    await lift(first.body.id).expect(200);
    await lift(first.body.id, 'Otra decisión').expect(409);
    expect(
      db
        .rows('auditorias_usuario')
        .filter((r) => r.accion === 'SUSPENSION_LEVANTADA'),
    ).toHaveLength(1);
    expect(db.rows('incumplimientos')).toHaveLength(1);
  });
  it('rechains queued temporary sanctions preserving each duration, and lifting queued ones cannot reactivate them', async () => {
    const a = await suspend().expect(201);
    const b = await suspend(suspension({ requestId: uuid(101) })).expect(201);
    const c = await suspend(suspension({ requestId: uuid(102) })).expect(201);
    expect(b.body.status).toBe('PROGRAMADA');
    expect(b.body.startsAt).toBe(a.body.endsAt);
    expect(c.body.startsAt).toBe(b.body.endsAt);
    await lift(b.body.id).expect(200);
    let queued = (await get(`/sanctions/${c.body.id}`).expect(200)).body;
    expect(queued.startsAt).toBe(a.body.endsAt);
    expect(Date.parse(queued.endsAt) - Date.parse(queued.startsAt)).toBe(
      temporary.suspensionDays! * 86400000,
    );
    await lift(a.body.id).expect(200);
    queued = (await get(`/sanctions/${c.body.id}`).expect(200)).body;
    expect(queued.status).toBe('ACTIVA');
    expect(Date.parse(queued.startsAt)).toBeLessThan(Date.parse(a.body.endsAt));
    const lifted = (await get(`/sanctions/${b.body.id}`).expect(200)).body;
    expect(lifted.status).toBe('FINALIZADA');
    expect(Date.parse(lifted.startsAt)).toBeLessThanOrEqual(
      Date.parse(lifted.endsAt),
    );
    expect(db.rows('usuarios')[0]!.confianza).toBe(
      (75 - temporary.penalty * 3).toFixed(2),
    );
    expect(
      queued.history.filter((h: any) => h.action === 'SUSPENSION_REPROGRAMADA'),
    ).toHaveLength(2);
  });
  it('rejects arbitrary dates and accepts only confirmation of the automatic policy calendar', async () => {
    const startsAt = new Date(Date.now() + 86400000 * 60).toISOString();
    const endsAt = new Date(
      Date.parse(startsAt) + temporary.suspensionDays! * 86400000,
    ).toISOString();
    await suspend(
      suspension({ requestId: uuid(101), startsAt, endsAt }),
    ).expect(400);
    const a = await suspend().expect(201);
    const expectedEnd = new Date(
      Date.parse(a.body.endsAt) + temporary.suspensionDays! * 86400000,
    ).toISOString();
    const b = await suspend(
      suspension({
        requestId: uuid(101),
        startsAt: a.body.endsAt,
        endsAt: expectedEnd,
      }),
    ).expect(201);
    expect(b.body.status).toBe('PROGRAMADA');
    expect(b.body.startsAt).toBe(a.body.endsAt);
    await lift(a.body.id).expect(200);
    expect(
      (await get(`/sanctions/${b.body.id}`).expect(200)).body.startsAt,
    ).not.toBe(a.body.endsAt);
  });
  it('rolls back lift and reprogramming if audit fails; refuses expired/absolved/missing sanctions', async () => {
    const a = await suspend().expect(201);
    const before = (await get(`/sanctions/${a.body.id}`).expect(200)).body;
    await lift(oldSanction).expect(409);
    await lift(uuid(999)).expect(404);
    db.rows('sanciones').find((r) => r.id === oldSanction)!.estado = 'ABSUELTA';
    await lift(oldSanction).expect(409);
    db.failAudit();
    await expect(repo.lift(a.body.id, 'Motivo', actor)).rejects.toThrow(
      'audit unavailable',
    );
    const after = (await get(`/sanctions/${a.body.id}`).expect(200)).body;
    expect(after.status).toBe(before.status);
    expect(after.endsAt).toBe(before.endsAt);
    expect(after.history).toEqual(before.history);
  });
  it('rechecks effective sanctions inside create and pickup transactions even after stale prechecks', async () => {
    const a = await suspend().expect(201);
    db.rows('reservas')[0]!.estado = 'CONFIRMADA';
    db.rows('ejemplares')[0]!.estado = 'RESERVADO';
    const reservations = new PrismaReservationRepository(
      db as unknown as PrismaService,
    );
    await expect(
      reservations.pickup(reservationId, new Date()),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
    expect(db.rows('ejemplares')[0]!.estado).toBe('RESERVADO');
    db.rows('ejemplares')[0]!.estado = 'DISPONIBLE';
    await expect(
      reservations.create({
        userId,
        copyId,
        requestedAt: new Date(),
        pickupDeadline: new Date(Date.now() + 600000),
        loanDurationHours: 8,
        enforceSingleOpenOperation: false,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.rows('ejemplares')[0]!.estado).toBe('DISPONIBLE');
    expect(a.body.id).toBeTruthy();
  });
  it('keeps accepted appeal restitution separate from administrative lift and audits the real resolver', async () => {
    const a = await suspend().expect(201);
    await lift(a.body.id).expect(200);
    db.rows('apelaciones').push({
      id: uuid(60),
      incumplimientoId: a.body.violationId,
      sancionId: a.body.id,
      usuarioId: userId,
      motivo: 'Apelación fundada',
      fecha: instant(),
      estado: 'PENDIENTE',
      resolucion: null,
      fechaResolucion: null,
      resueltaPorCuentaId: null,
    });
    const appeals = new PrismaAppealRepository(db as unknown as PrismaService);
    await appeals.resolve({
      appealId: uuid(60),
      status: AppealStatus.ACCEPTED,
      resolution: 'Absolución fundada',
      resolvedAt: new Date(),
      resolvedByAccountId: accountId,
    });
    expect(db.rows('usuarios')[0]!.confianza).toBe('75.00');
    const result = await get(`/sanctions/${a.body.id}`).expect(200);
    expect(result.body.status).toBe('ABSUELTA');
    expect(result.body.appeals[0].status).toBe('ACEPTADA');
    expect(result.body.history).toContainEqual(
      expect.objectContaining({
        action: 'CONFIANZA_RESTITUIDA_POR_APELACION',
        actorAccountId: accountId,
        reason: 'Absolución fundada',
      }),
    );
  });
  it('documents full nested schemas, query parameters, JWT and exact role metadata', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const schemas = doc.components!.schemas!;
    for (const [name, fields] of [
      [
        'SanctionDetailResponseDto',
        [
          'id',
          'userId',
          'ruleVersionId',
          'rule',
          'reason',
          'violation',
          'appeals',
          'history',
          'startsAt',
          'endsAt',
        ],
      ],
      ['AppealsPageResponseDto', ['items', 'total', 'page', 'limit']],
      [
        'SuspendUserDto',
        ['ruleId', 'reason', 'requestId', 'startsAt', 'endsAt'],
      ],
    ] as const)
      expect(Object.keys((schemas[name] as SchemaObject).properties!)).toEqual(
        expect.arrayContaining([...fields]),
      );
    expect(doc.paths['/appeals']!.get!.parameters).toHaveLength(5);
    expect(
      doc.paths['/sanctions/{sanctionId}/lift']!.post!.responses['200'],
    ).toBeDefined();
    for (const name of ['suspend', 'lift'] as const)
      expect(
        deriveAuthorization(
          SanctionsController,
          SanctionsController.prototype[name],
        ),
      ).toMatchObject({
        'x-roles': [AccessRole.ADMINISTRATOR],
        security: [{ bearer: [] }],
      });
    for (const name of ['detail', 'list'] as const)
      expect(
        deriveAuthorization(
          SanctionsController,
          SanctionsController.prototype[name],
        ),
      ).toMatchObject({
        'x-roles': [
          AccessRole.USER,
          AccessRole.OPERATOR,
          AccessRole.ADMINISTRATOR,
        ],
      });
  });
});

it('builds native ORM count/filter plans offline without initializing clients or loading environment', async () => {
  const builder = postgres({ contractJson }),
    query = vi.fn().mockResolvedValue([]);
  const prisma = {
    sql: builder.sql,
    client: { runtime: () => ({ query }) },
  } as unknown as PrismaService;
  await new PrismaSanctionRepository(prisma).listAppeals({
    page: 1,
    limit: 20,
  });
  await new PrismaSanctionRepository(prisma).listAppeals({
    page: 2,
    limit: 1,
    userId,
    sanctionId: oldSanction,
    status: AppealStatus.PENDING,
  });
  expect(query.mock.calls).toHaveLength(4);
  expect(
    query.mock.calls.every(([plan]) => plan.ast && plan.meta.lane === 'dsl'),
  ).toBe(true);
});
