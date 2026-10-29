import 'reflect-metadata';
import {
  type INestApplication,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  DocumentBuilder,
  SwaggerModule,
  type SchemaObject,
} from '@nestjs/swagger';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthController } from '../src/modules/auth/presentation/controllers/auth.controller.js';
import { RegisterAccessAccountUseCase } from '../src/modules/auth/application/use-cases/register-access-account.use-case.js';
import { AuthenticateAccountUseCase } from '../src/modules/auth/application/use-cases/authenticate-account.use-case.js';
import { GetAccessAccountUseCase } from '../src/modules/auth/application/use-cases/get-access-account.use-case.js';
import { UpdateAccessAccountUseCase } from '../src/modules/auth/application/use-cases/update-access-account.use-case.js';
import { FullRegistrationUseCase } from '../src/modules/auth/application/use-cases/full-registration.use-case.js';
import { GoogleAuthenticationUseCase } from '../src/modules/auth/application/use-cases/google-authentication.use-case.js';
import { GoogleIdentityPort } from '../src/modules/auth/application/ports/google-identity.port.js';
import { GoogleIdentityAdapter } from '../src/modules/auth/infrastructure/security/google-identity.adapter.js';
import { JwtPort } from '../src/modules/auth/application/ports/jwt.port.js';
import { AuthGuard } from '../src/modules/auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../src/modules/auth/presentation/guards/roles.guard.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';
import { deriveAuthorization } from '../src/shared/presentation/openapi/authorization-metadata.js';
import { ListAccountsDto } from '../src/modules/auth/presentation/dto/list-accounts.dto.js';
import { FullRegistrationDto } from '../src/modules/auth/presentation/dto/full-registration.dto.js';
import {
  GoogleAuthorizationDto,
  GoogleExchangeDto,
} from '../src/modules/auth/presentation/dto/google-authentication.dto.js';
import { UpdateAccessAccountDto } from '../src/modules/auth/presentation/dto/update-access-account.dto.js';

vi.mock('dotenv/config', () => ({}));
const userId = '123e4567-e89b-42d3-a456-426614174001';
const accountId = '123e4567-e89b-42d3-a456-426614174002';
const otherId = '123e4567-e89b-42d3-a456-426614174003';
const safe = {
  id: accountId,
  userId,
  email: 'user@unsa.edu.pe',
  role: AccessRole.USER,
  enabled: true,
  lastAccessAt: null,
};
const account = { ...safe, passwordHash: 'never-return-this' };

describe('Auth contracts HTTP + live Swagger metadata, no DB or generated artifacts', () => {
  let app: INestApplication;
  const forUser = vi.fn().mockResolvedValue([account]);
  const executeFull = vi
    .fn()
    .mockResolvedValue({ id: otherId, status: 'PENDIENTE' });
  const update = vi.fn().mockResolvedValue(account);
  const jwt = {
    sign: () => 'isolated-jwt',
    verify: (role: string) => {
      if (!Object.values(AccessRole).includes(role as AccessRole))
        throw new UnauthorizedException();
      return { accountId, userId, role, userType: 'ESTUDIANTE' };
    },
  };
  const states = { findById: vi.fn().mockImplementation(async () => account) };

  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    const types = [
      RegisterAccessAccountUseCase,
      AuthenticateAccountUseCase,
      GetAccessAccountUseCase,
      JwtPort,
      UpdateAccessAccountUseCase,
      GoogleIdentityPort,
      GoogleAuthenticationUseCase,
      FullRegistrationUseCase,
    ];
    Reflect.defineMetadata('design:paramtypes', types, AuthController);
    for (const [method, params] of [
      ['accountsForUser', [ListAccountsDto]],
      ['registerFull', [FullRegistrationDto]],
      ['authorizeGoogle', [GoogleAuthorizationDto, Object]],
      ['exchangeGoogle', [GoogleExchangeDto, Object, Object]],
      ['update', [String, UpdateAccessAccountDto, Object]],
    ] as const)
      Reflect.defineMetadata(
        'design:paramtypes',
        params,
        AuthController.prototype,
        method,
      );
    const values = [
      {},
      {},
      { execute: async () => account, forUser },
      jwt,
      { execute: update },
      new GoogleIdentityAdapter(),
      {},
      { execute: executeFull },
    ];
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: types.map((provide, index) => ({
        provide,
        useValue: values[index],
      })),
    })
      .overrideGuard(AuthGuard)
      .useValue(new AuthGuard(jwt as any, states as any))
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
  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  function authorize(role: AccessRole) {
    states.findById.mockResolvedValue({ ...account, role });
    return role;
  }
  it('F10 requires admin, validates exact userId, returns only safe fields', async () => {
    await request(app.getHttpServer()).get('/auth/accounts').expect(401);
    for (const role of [AccessRole.USER, AccessRole.OPERATOR])
      await request(app.getHttpServer())
        .get(`/auth/accounts?userId=${userId}`)
        .auth(authorize(role), { type: 'bearer' })
        .expect(403);
    const admin = authorize(AccessRole.ADMINISTRATOR);
    await request(app.getHttpServer())
      .get('/auth/accounts')
      .auth(admin, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/auth/accounts?userId=invalid')
      .auth(admin, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/auth/accounts?userId=${userId}&role=ADMINISTRADOR`)
      .auth(admin, { type: 'bearer' })
      .expect(400);
    const response = await request(app.getHttpServer())
      .get(`/auth/accounts?userId=${userId}`)
      .auth(admin, { type: 'bearer' })
      .expect(200);
    expect(response.body).toEqual({ items: [safe] });
    expect(forUser).toHaveBeenCalledWith(userId);
    forUser.mockResolvedValueOnce([]);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/auth/accounts?userId=${otherId}`)
          .auth(admin, { type: 'bearer' })
          .expect(200)
      ).body,
    ).toEqual({ items: [] });
  });
  it('keeps account ownership and rejects disabled or stale-role tokens', async () => {
    await request(app.getHttpServer())
      .get(`/auth/accounts/${otherId}`)
      .auth(authorize(AccessRole.OPERATOR), { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get(`/auth/accounts/${accountId}`)
      .auth(authorize(AccessRole.USER), { type: 'bearer' })
      .expect(200);
    states.findById.mockResolvedValue({ ...account, enabled: false });
    await request(app.getHttpServer())
      .get(`/auth/accounts/${accountId}`)
      .auth(AccessRole.USER, { type: 'bearer' })
      .expect(401);
    states.findById.mockResolvedValue({ ...account, role: AccessRole.USER });
    await request(app.getHttpServer())
      .get(`/auth/accounts?userId=${userId}`)
      .auth(AccessRole.ADMINISTRATOR, { type: 'bearer' })
      .expect(401);
  });
  it('public F03 rejects privilege injection, malformed DTOs and returns only pending confirmation', async () => {
    const body = {
      name: 'Nombre completo',
      email: 'new@unsa.edu.pe',
      password: 'isolated-test',
      userType: 'ESTUDIANTE',
      termsVersionId: otherId,
      evidence: ['image fixture'],
    };
    await request(app.getHttpServer())
      .post('/auth/registration-requests')
      .send({ ...body, role: 'ADMINISTRADOR' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/registration-requests')
      .send({ ...body, userType: 'ADMINISTRADOR' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/registration-requests')
      .send({ ...body, password: 'short' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/registration-requests')
      .send({ ...body, evidence: [] })
      .expect(400);
    expect(
      (
        await request(app.getHttpServer())
          .post('/auth/registration-requests')
          .send(body)
          .expect(201)
      ).body,
    ).toEqual({ id: otherId, status: 'PENDIENTE' });
  });
  it('F01 without provider configuration fails explicitly; malformed callback is 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/google/authorization')
      .send({ email: 'user@unsa.edu.pe' })
      .expect(503);
    await request(app.getHttpServer())
      .post('/auth/google/authenticate')
      .send({ email: 'user@unsa.edu.pe' })
      .expect(400);
  });
  it('account update uses verified actor and admin-only permissions', async () => {
    await request(app.getHttpServer())
      .patch(`/auth/accounts/${accountId}`)
      .auth(authorize(AccessRole.OPERATOR), { type: 'bearer' })
      .send({ role: AccessRole.USER })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/auth/accounts/${accountId}`)
      .auth(authorize(AccessRole.ADMINISTRATOR), { type: 'bearer' })
      .send({ enabled: true })
      .expect(200);
    for (const body of [{ enabled: null }, { role: null }, { enabled: 'true' }])
      await request(app.getHttpServer())
        .patch(`/auth/accounts/${accountId}`)
        .auth(authorize(AccessRole.ADMINISTRATOR), { type: 'bearer' })
        .send(body)
        .expect(400);
    expect(update).toHaveBeenCalledWith(
      { accountId, role: undefined, enabled: true },
      expect.objectContaining({
        accountId,
        userId,
        role: AccessRole.ADMINISTRATOR,
      }),
    );
  });
  it('documents complete responses and derives exact roles from existing guards, without writing OpenAPI', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    for (const [path, method, status, dto] of [
      [
        '/auth/google/authorization',
        'post',
        '201',
        'GoogleAuthorizationResponseDto',
      ],
      ['/auth/google/authenticate', 'post', '201', 'AuthenticationResponseDto'],
      [
        '/auth/registration-requests',
        'post',
        '201',
        'PendingRegistrationResponseDto',
      ],
      ['/auth/accounts', 'get', '200', 'AccountsResponseDto'],
    ] as const) {
      expect(doc.paths[path]?.[method]?.responses[status]).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${dto}` },
          },
        },
      });
      expect(
        Object.keys(
          (doc.components!.schemas![dto] as SchemaObject).properties!,
        ),
      ).not.toHaveLength(0);
    }
    expect(
      deriveAuthorization(
        AuthController,
        AuthController.prototype.accountsForUser,
      )['x-roles'],
    ).toEqual([AccessRole.ADMINISTRATOR]);
    expect(
      deriveAuthorization(
        AuthController,
        AuthController.prototype.registerFull,
      )['x-authentication'].required,
    ).toBe(false);
    expect(
      doc.paths['/auth/google/authorization']!.post!.responses['503'],
    ).toBeDefined();
  });
});
