import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
  type SchemaObject,
} from '@nestjs/swagger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Temporal } from 'temporal-polyfill/full';
import { InventoryService } from '../src/modules/inventory/application/use-cases/inventory.service.js';
import { PrismaInventoryRepository } from '../src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.js';
import { InventoryController } from '../src/modules/inventory/presentation/controllers/inventory.controller.js';
import { UpdateCopyStateDto } from '../src/modules/inventory/presentation/dto/update-copy-state.dto.js';
import { UpdateCopyDto } from '../src/modules/inventory/presentation/dto/update-copy.dto.js';
import {
  physicalConditions,
  type CopyVerification,
} from '../src/modules/inventory/domain/entities/inventory.types.js';
import { AuthGuard } from '../src/modules/auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../src/modules/auth/presentation/guards/roles.guard.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';
import { InventoryLoansAdapter } from '../src/modules/loans/infrastructure/integration/inventory-loans.adapter.js';
import { PrismaReservationRepository } from '../src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.js';
import { LoanOverdueSynchronizer } from '../src/modules/loans/infrastructure/loan-overdue-synchronizer.js';
import { assertActiveInventory } from '../src/modules/loans/infrastructure/integration/capture-loan-configuration.js';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';

const categoryId = '123e4567-e89b-42d3-a456-426614174001';
const resourceId = '123e4567-e89b-42d3-a456-426614174002';
const copyId = '123e4567-e89b-42d3-a456-426614174003';
const loanId = '123e4567-e89b-42d3-a456-426614174004';
const evidenceId = '123e4567-e89b-42d3-a456-426614174005';
const otherId = '123e4567-e89b-42d3-a456-426614174006';
const actor = {
  userId: 'operator-user',
  accountId: 'operator-account',
  role: AccessRole.OPERATOR,
};
const verification: CopyVerification = {
  fitForLoan: true,
  componentsComplete: true,
  reason: ' Reparación e inspección completa ',
  evidenceIds: [],
};
const initial = {
  categorias_recurso: [
    { id: categoryId, activo: true, tiempoMaximoPrestamoDias: 1 },
  ],
  recursos: [
    { id: resourceId, categoriaId: categoryId, activo: true, nombre: 'Equipo' },
  ],
  ejemplares: [
    {
      id: copyId,
      recursoId: resourceId,
      codigoInventario: 'TEST-1',
      estado: 'NO_DISPONIBLE',
      condicionFisica: 'DANADO',
      habilitado: true,
    },
  ],
  prestamos: [
    { id: loanId, ejemplarId: copyId, estado: 'CERRADO_POR_INCIDENCIA' },
  ],
  evidencias_prestamo: [{ id: evidenceId, prestamoId: loanId, tipo: 'DANO' }],
  usuarios: [{ id: 'owner', confianza: '0.00' }],
  sanciones: [{ id: 'sanction', estado: 'ACTIVA', bloqueoIndefinido: true }],
  movimientos_confianza: [{ id: 'original-movement' }],
};

function fixture(extra = {}) {
  const db = inMemoryPrisma({ ...initial, ...extra });
  const prisma = db as unknown as PrismaService;
  const repository = new PrismaInventoryRepository(prisma);
  const service = new InventoryService(repository);
  const write = <T>(work: (s: InventoryService) => Promise<T>) =>
    service.mutate(actor, 'INVENTARIO_ESTADO_EDITADO', work);
  const rehabilitate = (v: CopyVerification | undefined = verification) =>
    write((s) =>
      s.updateCopyState(copyId, {
        estado: 'DISPONIBLE',
        ...(v ? { verification: v } : {}),
      }),
    );
  return { db, prisma, repository, service, write, rehabilitate };
}

afterEach(() => vi.restoreAllMocks());

describe('rehabilitación con repositorio productivo y transacciones en memoria, sin PostgreSQL', () => {
  it('adquiere barrera global de inventario antes de filas de rehabilitación', async () => {
    const f = fixture();
    await f.rehabilitate();
    const firstWrite = f.db.calls.findIndex((p) => p.operation === 'update');
    expect(f.db.calls.slice(0, firstWrite).some((p) => p.text?.includes('SHARE ROW EXCLUSIVE MODE NOWAIT'))).toBe(true);
  });
  it.each([null, ...physicalConditions])(
    'exige verificación desde retenido con condición %s; conserva sanciones y confianza',
    async (condition) => {
      const f = fixture();
      f.db.rows('ejemplares')[0]!.condicionFisica = condition;
      await expect(
        f.write((s) => s.updateCopyState(copyId, { estado: 'DISPONIBLE' })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(f.db.rows('ejemplares')[0]!.estado).toBe('NO_DISPONIBLE');
      expect(f.db.rows('auditorias_usuario')).toEqual([]);
      const before = ['usuarios', 'sanciones', 'movimientos_confianza'].map(
        (t) => structuredClone(f.db.rows(t)),
      );
      expect(
        await f.rehabilitate({ ...verification, evidenceIds: [evidenceId] }),
      ).toMatchObject({
        estado: 'DISPONIBLE',
        condicionFisica: 'APTO',
        habilitado: true,
      });
      expect(
        ['usuarios', 'sanciones', 'movimientos_confianza'].map((t) =>
          f.db.rows(t),
        ),
      ).toEqual(before);
      expect(
        f.db.calls.filter((p) =>
          ['usuarios', 'sanciones', 'movimientos_confianza'].includes(p.table),
        ),
      ).toEqual([]);
      const audit = f.db.rows('auditorias_usuario')[0]!;
      expect(audit.usuarioId).toBe(actor.userId);
      expect(JSON.parse(audit.datosNuevos)).toMatchObject({
        actor,
        copyTransitions: [
          {
            copyId,
            before: { condicionFisica: condition },
            after: { condicionFisica: 'APTO' },
            verification: {
              reason: verification.reason.trim(),
              evidenceIds: [evidenceId],
            },
          },
        ],
      });
    },
  );

  it('null DISPONIBLE no es apto y no evade verificación mediante no-op, código, habilitación o recurso', async () => {
    const f = fixture();
    Object.assign(f.db.rows('ejemplares')[0]!, {
      condicionFisica: null,
      estado: 'DISPONIBLE',
    });
    await f.write((s) =>
      s.updateCopy(copyId, { codigoInventario: 'renamed', habilitado: true }),
    );
    await f.write((s) => s.updateResource(resourceId, { activo: false }));
    await f.write((s) =>
      s.updateResource(resourceId, { activo: true, categoriaId: categoryId }),
    );
    await expect(
      f.write((s) => s.updateCopyState(copyId, { estado: 'DISPONIBLE' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await f.service.getCopy(copyId)).toMatchObject({
      condicionFisica: null,
      habilitado: true,
    });
    await f.write((s) =>
      s.updateCopyState(copyId, { estado: 'NO_DISPONIBLE' }),
    );
    await expect(
      f.write((s) => s.updateCopyState(copyId, { estado: 'DISPONIBLE' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await f.rehabilitate();
    expect(f.db.rows('ejemplares')[0]!.condicionFisica).toBe('APTO');
  });

  it('crea sano APTO/habilitado explícitos y permite no-op sano sin rehabilitación', async () => {
    const f = fixture();
    const copy = await f.write((s) =>
      s.createCopy(resourceId, { codigoInventario: 'NEW' }),
    );
    expect(copy).toMatchObject({
      condicionFisica: 'APTO',
      habilitado: true,
      estado: 'DISPONIBLE',
    });
    expect(
      await f.write((s) =>
        s.updateCopyState(copy.id, { estado: 'DISPONIBLE' }),
      ),
    ).toEqual(copy);
  });

  it('retiro y habilitación administrativos no rehabilitan; verificación no habilita implícitamente', async () => {
    const f = fixture();
    await f.write((s) => s.deleteCopy(copyId));
    await expect(f.rehabilitate()).rejects.toBeInstanceOf(ConflictException);
    await f.write((s) => s.updateCopy(copyId, { habilitado: true }));
    expect(f.db.rows('ejemplares')[0]!).toMatchObject({
      estado: 'NO_DISPONIBLE',
      condicionFisica: 'DANADO',
      habilitado: true,
    });
    await expect(
      f.write((s) => s.updateCopyState(copyId, { estado: 'DISPONIBLE' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await f.rehabilitate();
  });

  it.each(['recursos', 'categorias_recurso'])(
    'rechaza rehabilitación con %s inactivo y conserva condición',
    async (table) => {
      const f = fixture();
      f.db.rows(table)[0]!.activo = false;
      await expect(f.rehabilitate()).rejects.toBeInstanceOf(ConflictException);
      expect(f.db.rows('ejemplares')[0]!.condicionFisica).toBe('DANADO');
      expect(f.db.rows('auditorias_usuario')).toEqual([]);
    },
  );

  it.each(['ACTIVO', 'PLANIFICADO', 'CONFIRMADA'])(
    'rechaza compromisos %s incluso si el estado del ejemplar es inconsistente',
    async (state) => {
      const f = fixture(
        state === 'CONFIRMADA'
          ? {
              reservas: [
                { id: 'reservation', ejemplarId: copyId, estado: state },
              ],
            }
          : { prestamos: [{ id: loanId, ejemplarId: copyId, estado: state }] },
      );
      await expect(f.rehabilitate()).rejects.toBeInstanceOf(ConflictException);
      await expect(
        f.write((s) => s.updateCopy(copyId, { habilitado: true })),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(f.db.rows('auditorias_usuario')).toEqual([]);
    },
  );

  it.each(['missing', 'foreign'])(
    'rechaza evidencia %s sin modificar el ejemplar',
    async (kind) => {
      const f = fixture();
      if (kind === 'foreign') f.db.rows('prestamos')[0]!.ejemplarId = otherId;
      await expect(
        f.rehabilitate({
          ...verification,
          evidenceIds: [kind === 'missing' ? otherId : evidenceId],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(f.db.rows('ejemplares')[0]!.condicionFisica).toBe('DANADO');
      expect(f.db.rows('auditorias_usuario')).toEqual([]);
    },
  );

  it('revierte condición y estado si falla auditoría; rechaza rehabilitación sin actor', async () => {
    const f = fixture();
    await expect(
      f.repository.updateManagedCopy(copyId, {
        estado: 'DISPONIBLE',
        verification,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    f.db.failAudit();
    await expect(f.rehabilitate()).rejects.toThrow('audit unavailable');
    expect(f.db.rows('ejemplares')).toEqual(initial.ejemplares);
    expect(f.db.rows('auditorias_usuario')).toEqual([]);
  });

  it.each([
    null,
    'DANADO',
    'INCOMPLETO',
    'DANADO_E_INCOMPLETO',
    'PERDIDO',
    'ROBADO',
    'DISABLED',
  ])(
    'disponibilidad y adaptador de préstamos rechazan %s aunque figure DISPONIBLE',
    async (condition) => {
      const f = fixture();
      Object.assign(f.db.rows('ejemplares')[0]!, {
        estado: 'DISPONIBLE',
        condicionFisica: condition === 'DISABLED' ? 'APTO' : condition,
        habilitado: condition !== 'DISABLED',
      });
      vi.spyOn(f.repository, 'getCategoryPolicies').mockResolvedValue({
        eligibleForNewOperations: true,
      } as never);
      expect(
        await new InventoryLoansAdapter(f.service).getAvailability(copyId),
      ).toMatchObject({ available: false });
      expect(await f.service.getResourceAvailability(resourceId)).toMatchObject(
        { available: false, totalCopies: 1, disponibles: 0, noDisponibles: 1 },
      );
      expect(
        (await f.service.listResources({ available: 'true' })).data,
      ).toEqual([]);
      expect((await f.service.getGlobalAvailability())[0]).toMatchObject({
        available: false,
        availableCopies: 0,
        totalCopies: 1,
      });
      await expect(f.service.markCopyAsLoaned(copyId)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(
        assertActiveInventory(f.prisma, f.prisma.client.runtime(), copyId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(f.db.rows('ejemplares')[0]!.condicionFisica).toBe(
        condition === 'DISABLED' ? 'APTO' : condition,
      );
    },
  );

  it('sano retenido no disponible; tras verificación sí está disponible en todas las consultas', async () => {
    const f = fixture();
    f.db.rows('ejemplares')[0]!.condicionFisica = 'APTO';
    vi.spyOn(f.repository, 'getCategoryPolicies').mockResolvedValue({
      eligibleForNewOperations: true,
    } as never);
    expect((await f.service.getLoanAvailability(copyId)).available).toBe(false);
    await f.rehabilitate();
    expect((await f.service.getLoanAvailability(copyId)).available).toBe(true);
    expect(await f.service.getResourceAvailability(resourceId)).toMatchObject({
      disponibles: 1,
      available: true,
    });
  });

  it.each(['create', 'pickup'] as const)(
    'repositorio de reservas impide %s de null/dañado/deshabilitado sin confiar en adaptador',
    async (operation) => {
      vi.spyOn(
        LoanOverdueSynchronizer.prototype,
        'synchronizeUser',
      ).mockResolvedValue(undefined);
      vi.spyOn(
        LoanOverdueSynchronizer.prototype,
        'recheckLocked',
      ).mockResolvedValue(null);
      for (const condition of [null, 'DANADO', 'DISABLED']) {
        const now = new Date();
        const instant = (ms: number) =>
          Temporal.Instant.fromEpochMilliseconds(ms);
        const f = fixture({
          usuarios: [
            { id: 'owner', tipoUsuario: 'DOCENTE', vinculacionVigente: true },
          ],
          reservas: [
            {
              id: 'reservation',
              usuarioId: 'owner',
              ejemplarId: copyId,
              estado: 'CONFIRMADA',
              fechaSolicitada: instant(now.getTime() - 60_000),
              fechaLimiteRecogida: instant(now.getTime() + 3_600_000),
              duracionPrestamoHoras: 1,
            },
          ],
        });
        Object.assign(f.db.rows('ejemplares')[0]!, {
          estado: operation === 'create' ? 'DISPONIBLE' : 'RESERVADO',
          condicionFisica: condition === 'DISABLED' ? 'APTO' : condition,
          habilitado: condition !== 'DISABLED',
        });
        const repo = new PrismaReservationRepository(f.prisma);
        vi.spyOn(repo, 'expire').mockResolvedValue([]);
        await expect(
          operation === 'create'
            ? repo.create({
                userId: 'owner',
                copyId,
                requestedAt: now,
                loanDurationHours: 1,
                enforceSingleOpenOperation: false,
              })
            : repo.pickup('reservation', now),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(f.db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
        expect(f.db.rows('prestamos')).toHaveLength(1);
      }
    },
  );
});

describe('contrato HTTP de verificación, permisos y anotaciones sin conexiones externas', () => {
  let app: INestApplication;
  let f: ReturnType<typeof fixture>;
  let identity: typeof actor;
  beforeEach(async () => {
    f = fixture();
    identity = actor;
    Reflect.defineMetadata(
      'design:paramtypes',
      [InventoryService],
      InventoryController,
    );
    for (const [name, types] of [
      ['updateCopyState', [String, UpdateCopyStateDto, Object]],
      ['updateCopy', [String, UpdateCopyDto, Object]],
    ] as const)
      Reflect.defineMetadata(
        'design:paramtypes',
        types,
        InventoryController.prototype,
        name,
      );
    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: f.service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().user = identity;
          return true;
        },
      })
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
    await app?.close();
  });
  const statePath = `/inventory/copies/${copyId}/state`;

  it.each([
    null,
    {},
    { ...verification, fitForLoan: false },
    { ...verification, componentsComplete: false },
    { ...verification, reason: ' ' },
    { ...verification, reason: 'x'.repeat(1001) },
    { ...verification, evidenceIds: undefined },
    { ...verification, evidenceIds: null },
    { ...verification, evidenceIds: ['bad'] },
    { ...verification, evidenceIds: [evidenceId, evidenceId.toUpperCase()] },
    { ...verification, extra: true },
  ])('rechaza verificación inválida %j sin escribir', async (value) => {
    await request(app.getHttpServer())
      .patch(statePath)
      .send({ estado: 'DISPONIBLE', verification: value })
      .expect(400);
    expect(f.db.rows('auditorias_usuario')).toEqual([]);
    expect(f.db.rows('ejemplares')).toEqual(initial.ejemplares);
  });

  it('operador verifica y actor queda persistido; no puede habilitar administrativamente; usuario no verifica', async () => {
    await request(app.getHttpServer())
      .patch(`/inventory/copies/${copyId}`)
      .send({ habilitado: true })
      .expect(403);
    await request(app.getHttpServer())
      .patch(statePath)
      .send({ estado: 'DISPONIBLE', verification, habilitado: true })
      .expect(400);
    await request(app.getHttpServer())
      .patch(statePath)
      .send({ estado: 'DISPONIBLE' })
      .expect(400);
    identity = { ...actor, role: AccessRole.USER };
    await request(app.getHttpServer())
      .patch(statePath)
      .send({ estado: 'DISPONIBLE', verification })
      .expect(403);
    identity = actor;
    const result = await request(app.getHttpServer())
      .patch(statePath)
      .send({ estado: 'DISPONIBLE', verification })
      .expect(200);
    expect(result.body).toMatchObject({
      condicionFisica: 'APTO',
      habilitado: true,
    });
    expect(
      JSON.parse(f.db.rows('auditorias_usuario')[0]!.datosNuevos).actor,
    ).toEqual(actor);
  });

  it('administrador puede retirar y habilitar sin alterar aptitud; no puede clasificar por PATCH alternativo', async () => {
    identity = { ...actor, role: AccessRole.ADMINISTRATOR };
    for (const habilitado of [false, true]) {
      const r = await request(app.getHttpServer())
        .patch(`/inventory/copies/${copyId}`)
        .send({ habilitado })
        .expect(200);
      expect(r.body).toMatchObject({
        habilitado,
        estado: 'NO_DISPONIBLE',
        condicionFisica: 'DANADO',
      });
    }
    for (const body of [
      { condicionFisica: 'APTO' },
      { estado: 'DISPONIBLE' },
      { habilitado: null },
      {},
    ])
      await request(app.getHttpServer())
        .patch(`/inventory/copies/${copyId}`)
        .send(body)
        .expect(400);
    await request(app.getHttpServer())
      .patch(statePath)
      .send({ estado: 'DISPONIBLE', verification })
      .expect(200);
  });

  it('describe verificación y condición nullable/habilitación en Swagger sin generar archivos', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const schemas = document.components!.schemas!;
    const v = schemas.CopyVerificationDto as SchemaObject;
    expect(v.required).toEqual(
      expect.arrayContaining([
        'fitForLoan',
        'componentsComplete',
        'reason',
        'evidenceIds',
      ]),
    );
    expect(v.properties!.reason).toMatchObject({ maxLength: 1000 });
    expect(v.properties!.evidenceIds).toMatchObject({
      type: 'array',
      uniqueItems: true,
    });
    expect((schemas.CopyResponseDto as SchemaObject).properties).toMatchObject({
      condicionFisica: { nullable: true, enum: [...physicalConditions] },
      habilitado: { type: 'boolean' },
    });
  });
});
