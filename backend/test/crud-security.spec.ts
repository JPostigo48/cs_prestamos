import 'reflect-metadata';
import {
  type INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { InventoryController } from '../src/modules/inventory/presentation/controllers/inventory.controller.js';
import { InventoryService } from '../src/modules/inventory/application/use-cases/inventory.service.js';
import { UsersController } from '../src/modules/users/presentation/controllers/users.controller.js';
import { ManageUsersUseCase } from '../src/modules/users/application/use-cases/manage-users.use-case.js';
import { GetUserUseCase } from '../src/modules/users/application/use-cases/get-user.use-case.js';
import { GetUserLoanEligibilityUseCase } from '../src/modules/users/application/use-cases/get-user-loan-eligibility.use-case.js';
import { GetUserTrustProfileUseCase } from '../src/modules/users/application/use-cases/get-user-trust-profile.use-case.js';
import { ListUserSanctionsUseCase } from '../src/modules/users/application/use-cases/list-user-sanctions.use-case.js';
import { ListUsersUseCase } from '../src/modules/users/application/use-cases/list-users.use-case.js';
import { AuthGuard } from '../src/modules/auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../src/modules/auth/presentation/guards/roles.guard.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';
import {
  CreateUserDto,
  UpdateUserDto,
} from '../src/modules/users/presentation/dto/manage-user.dto.js';
import { UpdateCopyDto } from '../src/modules/inventory/presentation/dto/update-copy.dto.js';

const id = '123e4567-e89b-42d3-a456-426614174001';
const otherId = '123e4567-e89b-42d3-a456-426614174002';
const inventoryWrites: [string, string, object][] = [
  [
    'post',
    '/inventory/categories',
    { nombre: 'Libros', tiempoMaximoPrestamoDias: 7 },
  ],
  ['patch', `/inventory/categories/${id}`, { nombre: 'Libros nuevos' }],
  ['delete', `/inventory/categories/${id}`, {}],
  ['post', '/inventory/resources', { categoriaId: id, nombre: 'Libro' }],
  ['patch', `/inventory/resources/${id}`, { nombre: 'Libro nuevo' }],
  ['delete', `/inventory/resources/${id}`, {}],
  ['post', `/inventory/resources/${id}/copies`, { codigoInventario: 'INV-1' }],
  ['patch', `/inventory/copies/${id}`, { codigoInventario: 'INV-2' }],
  ['delete', `/inventory/copies/${id}`, {}],
  ['patch', `/inventory/copies/${id}/state`, { estado: 'NO_DISPONIBLE' }],
  ['post', `/inventory/copies/${id}/observations`, { descripcion: 'Nota' }],
];
const userWrites: [string, string, object][] = [
  ['post', '/users', { name: 'Ada Lovelace', userType: 'ESTUDIANTE' }],
  ['patch', `/users/${id}`, { name: 'Ada Byron' }],
  ['delete', `/users/${id}`, {}],
  ['patch', `/users/${id}/affiliation-status`, { vinculacionVigente: false }],
];
const inventoryReads = [
  '/inventory/categories',
  `/inventory/categories/${id}`,
  '/inventory/resources',
  `/inventory/resources/${id}`,
  `/inventory/resources/${id}/copies`,
  `/inventory/copies/${id}`,
  `/inventory/copies/${id}/observations`,
  '/inventory/availability',
  `/inventory/resources/${id}/availability`,
];
const userReads = [
  '',
  '/loan-eligibility',
  '/trust',
  '/trust-profile',
  '/sanctions',
];

describe('CRUD controller permissions over HTTP, no DB', () => {
  let app: INestApplication;
  const inventory: Record<string, any> = {};
  const manage = {
    create: vi.fn().mockResolvedValue({ id }),
    update: vi.fn().mockResolvedValue({ id }),
    deactivate: vi.fn().mockResolvedValue({ id, hasCurrentAffiliation: false }),
  };
  const reader = { execute: vi.fn().mockResolvedValue({ id }) };

  beforeAll(async () => {
    for (const name of Object.getOwnPropertyNames(
      InventoryService.prototype,
    ).filter((name) => name !== 'constructor'))
      inventory[name] = vi.fn().mockResolvedValue({ id });
    inventory.mutate = vi.fn((_actor, _action, work) => work(inventory));
    // Vitest no emite design:paramtypes; se declara solo en este fixture HTTP.
    Reflect.defineMetadata(
      'design:paramtypes',
      [InventoryService],
      InventoryController,
    );
    const readers = [
      GetUserUseCase,
      GetUserLoanEligibilityUseCase,
      GetUserTrustProfileUseCase,
      ListUserSanctionsUseCase,
      ListUsersUseCase,
    ];
    Reflect.defineMetadata(
      'design:paramtypes',
      [...readers, ManageUsersUseCase],
      UsersController,
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [CreateUserDto, Object],
      UsersController.prototype,
      'create',
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [String, UpdateUserDto, Object],
      UsersController.prototype,
      'update',
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [String, UpdateCopyDto, Object],
      InventoryController.prototype,
      'updateCopy',
    );
    const jwt = {
      verify: (role: string) => {
        if (!Object.values(AccessRole).includes(role as AccessRole))
          throw new UnauthorizedException();
        return {
          accountId: `account-${role}`,
          userId: id,
          userType: 'ESTUDIANTE',
          role,
        };
      },
    };
    const module = await Test.createTestingModule({
      controllers: [InventoryController, UsersController],
      providers: [
        { provide: InventoryService, useValue: inventory },
        { provide: ManageUsersUseCase, useValue: manage },
        ...readers.map((provide) => ({ provide, useValue: reader })),
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(new AuthGuard(jwt as any))
      .overrideGuard(RolesGuard)
      .useValue(new RolesGuard(new Reflector()))
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  for (const role of [
    null,
    AccessRole.USER,
    AccessRole.OPERATOR,
    AccessRole.ADMINISTRATOR,
  ]) {
    it.each(inventoryWrites)(
      `inventory ${role ?? 'anonymous'}: %s %s`,
      async (method, path, body) => {
        let call = (request(app.getHttpServer()) as any)
          [method](path)
          .send(body);
        if (role) call = call.auth(role, { type: 'bearer' });
        const expected =
          role === null
            ? 401
            : role === AccessRole.USER
              ? 403
              : method === 'post'
                ? 201
                : 200;
        await call.expect(expected);
      },
    );
    it.each(userWrites)(
      `users ${role ?? 'anonymous'}: %s %s`,
      async (method, path, body) => {
        let call = (request(app.getHttpServer()) as any)
          [method](path)
          .send(body);
        if (role) call = call.auth(role, { type: 'bearer' });
        await call.expect(
          role === null
            ? 401
            : role !== AccessRole.ADMINISTRATOR
              ? 403
              : method === 'post'
                ? 201
                : 200,
        );
      },
    );
    it.each(inventoryReads)(
      `keeps inventory GET compatible for ${role ?? 'anonymous'}: %s`,
      async (path) => {
        let call = request(app.getHttpServer()).get(path);
        if (role) call = call.auth(role, { type: 'bearer' });
        await call.expect(200);
      },
    );
    it.each(userReads)(
      `keeps own/staff user GET for ${role ?? 'anonymous'}: %s`,
      async (suffix) => {
        let call = request(app.getHttpServer()).get(`/users/${id}${suffix}`);
        if (role) call = call.auth(role, { type: 'bearer' });
        await call.expect(role === null ? 401 : 200);
        let other = request(app.getHttpServer()).get(
          `/users/${otherId}${suffix}`,
        );
        if (role) other = other.auth(role, { type: 'bearer' });
        await other.expect(
          role === null ? 401 : role === AccessRole.USER ? 403 : 200,
        );
      },
    );
    it(`keeps list user policy for ${role ?? 'anonymous'}`, async () => {
      let call = request(app.getHttpServer()).get('/users');
      if (role) call = call.auth(role, { type: 'bearer' });
      await call.expect(
        role === null ? 401 : role === AccessRole.USER ? 403 : 200,
      );
    });
  }

  it('takes the audit actor from the verified JWT, not the DTO', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .auth(AccessRole.ADMINISTRATOR, { type: 'bearer' })
      .send({ name: 'Ada Lovelace', userType: 'ESTUDIANTE' })
      .expect(201);
    expect(manage.create).toHaveBeenLastCalledWith(
      { name: 'Ada Lovelace', userType: 'ESTUDIANTE' },
      expect.objectContaining({
        accountId: 'account-ADMINISTRADOR',
        userId: id,
      }),
    );
    await request(app.getHttpServer())
      .post('/users')
      .auth(AccessRole.ADMINISTRATOR, { type: 'bearer' })
      .send({
        name: 'Ada Lovelace',
        userType: 'ESTUDIANTE',
        actor: 'forged',
        role: 'ADMINISTRADOR',
        password: 'forbidden',
      })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/inventory/copies/${id}`)
      .auth(AccessRole.OPERATOR, { type: 'bearer' })
      .send({ codigoInventario: 'INV-2' })
      .expect(200);
    expect(inventory.mutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: 'account-OPERADOR', userId: id }),
      'INVENTARIO_EJEMPLAR_EDITADO',
      expect.any(Function),
    );
  });

  it('rejects invalid tokens and malformed/privileged payloads', async () => {
    await request(app.getHttpServer())
      .post('/inventory/categories')
      .auth('invalid', { type: 'bearer' })
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .auth(AccessRole.ADMINISTRATOR, { type: 'bearer' })
      .send({ name: null })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .auth(AccessRole.ADMINISTRATOR, { type: 'bearer' })
      .send({ trustPercentage: 100 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/inventory/copies/${id}`)
      .auth(AccessRole.OPERATOR, { type: 'bearer' })
      .send({ recursoId: otherId, codigoInventario: 'X' })
      .expect(400);
  });
});
