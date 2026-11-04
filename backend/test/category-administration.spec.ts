import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import postgres from '@prisma/orm-postgres/runtime';
import contractJson from '../prisma/contract.json' with { type: 'json' };
vi.mock('dotenv/config', () => ({}));
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';
import { categoryPolicyFixture } from './helpers/category-policy-fixture.js';
import { InventoryService } from '../src/modules/inventory/application/use-cases/inventory.service.js';
import { PrismaInventoryRepository } from '../src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.js';
import { PrismaReservationRepository } from '../src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.js';

const categoryId = '123e4567-e89b-42d3-a456-426614174001';
const resourceId = '123e4567-e89b-42d3-a456-426614174002';
const copyId = '123e4567-e89b-42d3-a456-426614174003';
const actor = { accountId: 'test-account', userId: 'test-staff' };
const initial = {
  categorias_recurso: [
    {
      id: categoryId,
      nombre: 'Libros',
      descripcion: 'Lectura',
      activo: true,
      tiempoMaximoPrestamoDias: 2,
      tiempoMaximoPrestamoHoras: 48,
    },
  ],
  recursos: [
    {
      id: resourceId,
      categoriaId: categoryId,
      nombre: 'Libro',
      activo: true,
      duracionPrestamoHoras: null,
    },
  ],
  ejemplares: [
    {
      id: copyId,
      recursoId: resourceId,
      codigoInventario: 'LIB-1',
      estado: 'DISPONIBLE',
    },
  ],
};
function setup(extra = {}) {
  const db = inMemoryPrisma({ ...initial, ...extra });
  const repository = new PrismaInventoryRepository(db as any);
  return {
    db,
    repository,
    service: new InventoryService(repository),
    reservations: new PrismaReservationRepository(db as any),
  };
}

describe('Categorías: repositorios reales sobre doble SQL offline, no garantías de PostgreSQL', () => {
  it('construye planes ORM nativos de bloqueo y borrado sin inicializar el driver', async () => {
    const builder = postgres({ contractJson });
    const query = vi.fn();
    for (const rows of [
      [],
      [{ id: categoryId, nombre: 'Vacía' }],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [{ id: categoryId }],
    ])
      query.mockResolvedValueOnce(rows);
    const prisma = {
      sql: builder.sql,
      client: {
        raw: builder.raw,
        transaction: async (
          work: (tx: { query: typeof query }) => Promise<unknown>,
        ) => work({ query }),
      },
    };
    expect(
      await new PrismaInventoryRepository(prisma as any).deleteCategory(
        categoryId,
      ),
    ).toBe(1);
    expect(query.mock.calls[0][0].meta.lane).toBe('raw');
    expect(query.mock.calls[0][0].ast.parts.join('')).toContain(
      'SHARE ROW EXCLUSIVE MODE NOWAIT',
    );
    expect(
      query.mock.calls
        .slice(1)
        .every(([plan]) => plan.ast && plan.meta.lane === 'dsl'),
    ).toBe(true);
  });
  it('crea, edita, cuenta, filtra, desactiva y reactiva sin alterar recursos ni historia', async () => {
    const { db, service } = setup({
      reservas: [
        { id: 'history', ejemplarId: copyId, duracionPrestamoHoras: 48 },
      ],
    });
    const history = structuredClone(db.rows('reservas'));
    const created = await service.createCategory({
      nombre: ' Nueva ',
      descripcion: ' Descripción ',
      activo: false,
      tiempoMaximoPrestamoDias: 1,
      tiempoMaximoPrestamoHoras: 8,
    });
    expect(created).toMatchObject({
      nombre: 'Nueva',
      descripcion: 'Descripción',
      activo: false,
      tiempoMaximoPrestamoHoras: 8,
    });
    expect(await service.getCategory(categoryId)).toMatchObject({
      resourceCount: 1,
      copyCount: 1,
    });
    await service.mutate(actor, 'INVENTARIO_CATEGORIA_EDITADA', (s) =>
      s.updateCategory(categoryId, {
        activo: false,
        descripcion: null,
        tiempoMaximoPrestamoHoras: 4,
      }),
    );
    expect(await service.listCategories('true')).toEqual([]);
    expect(await service.listCategories('false')).toHaveLength(2);
    expect(db.rows('reservas')).toEqual(history);
    expect(db.rows('recursos')).toHaveLength(1);
    expect(db.rows('ejemplares')).toHaveLength(1);
    expect(await service.getResourceAvailability(resourceId)).toMatchObject({
      available: false,
    });
    await service.updateCategory(categoryId, { activo: true });
    expect(await service.getCategory(categoryId)).toMatchObject({
      activo: true,
    });
  });

  it('caso 1: elimina una categoría vacía sin dependencias', async () => {
    const { service, db } = setup({ recursos: [], ejemplares: [] });
    expect(await service.previewCategoryDeletion(categoryId)).toMatchObject({
      canDelete: true,
      wouldDelete: { categories: 1, resources: 0, copies: 0 },
    });
    await expect(
      service.mutate(actor, 'INVENTARIO_CATEGORIA_ELIMINADA', (s) =>
        s.deleteCategory(categoryId),
      ),
    ).resolves.toEqual({ deleted: true, categoryId });
    expect(db.rows('categorias_recurso')).toHaveLength(0);
    expect(db.rows('auditorias_usuario')).toHaveLength(1);
  });

  it('persiste actividad de recursos e impide nuevas asignaciones incompatibles', async () => {
    const { service } = setup(categoryPolicyFixture(categoryId));
    expect((await service.getLoanAvailability(copyId)).available).toBe(true);
    await service.updateResource(resourceId, { activo: false });
    expect(await service.getResource(resourceId)).toMatchObject({
      activo: false,
      available: false,
    });
    expect((await service.getLoanAvailability(copyId)).available).toBe(false);
    await expect(
      service.createCopy(resourceId, { codigoInventario: 'NEW' }),
    ).rejects.toMatchObject({ status: 409 });
    await service.updateResource(resourceId, { activo: true });
    expect((await service.getLoanAvailability(copyId)).available).toBe(true);
    await service.updateCategory(categoryId, { activo: false });
    await expect(
      service.createResource({ categoriaId: categoryId, nombre: 'Nuevo' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.createCopy(resourceId, { codigoInventario: 'NEW' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('caso 2: borra conjunto completo en orden explícito, después del bloqueo', async () => {
    const { service, db } = setup({
      accesorios_recurso: [
        {
          id: 'accessory',
          recursoId: resourceId,
          nombre: 'Funda',
          activo: true,
        },
      ],
    });
    expect(await service.previewCategoryDeletion(categoryId)).toMatchObject({
      nombre: 'Libros',
      resourceIds: [resourceId],
      copyIds: [copyId],
      canDelete: true,
      wouldDelete: { categories: 1, resources: 1, copies: 1, accessories: 1 },
    });
    await service.deleteCategory(categoryId);
    expect(
      db.calls.filter((p) => p.operation === 'delete').map((p) => p.table),
    ).toEqual([
      'ejemplares',
      'accesorios_recurso',
      'recursos',
      'categorias_recurso',
    ]);
    const lock = db.calls.findIndex((p) => p.operation === 'lock');
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(db.calls[lock].text).toContain('SHARE ROW EXCLUSIVE MODE NOWAIT');
    expect(
      db.calls
        .slice(lock + 1)
        .some((p) => p.operation === 'select' && p.table === 'reservas'),
    ).toBe(true);
    for (const table of [
      'categorias_recurso',
      'recursos',
      'ejemplares',
      'accesorios_recurso',
    ])
      expect(db.rows(table)).toHaveLength(0);
  });

  it.each([
    ['reservas', { id: 'r', ejemplarId: copyId, estado: 'CANCELADA' }],
    ['prestamos', { id: 'l', ejemplarId: copyId, estado: 'FINALIZADO' }],
    ['observaciones_ejemplar', { id: 'o', ejemplarId: copyId }],
    [
      'inspecciones_devolucion',
      {
        id: 'i',
        parts: [{ id: 'accessory' }],
        configurationSnapshot: { resourceId },
      },
    ],
    [
      'versiones_regla',
      {
        id: 'v',
        descripcion: JSON.stringify({ categoryId }),
        estado: 'INACTIVA',
      },
    ],
    ['versiones_terminos', { id: 't', contenido: categoryId }],
    [
      'auditorias_usuario',
      { id: 'a', datosAnteriores: JSON.stringify({ id: copyId }) },
    ],
  ])('caso 3: conserva %s y ofrece desactivación', async (table, row) => {
    const { service, db } = setup({ [table]: [row] });
    const preview = await service.previewCategoryDeletion(categoryId);
    expect(preview).toMatchObject({
      canDelete: false,
      alternative: 'DEACTIVATE',
      wouldDelete: { categories: 0 },
    });
    expect(preview.blockers).toContainEqual(
      expect.objectContaining({ dependency: table, count: 1 }),
    );
    await expect(service.deleteCategory(categoryId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(db.rows(table)).toEqual([row]);
    expect(db.rows('categorias_recurso')).toHaveLength(1);
    expect(db.calls.some((p) => p.operation === 'delete')).toBe(false);
  });

  it('revalida aunque una previsualización anterior permitiera borrar', async () => {
    const { service, db } = setup({
      reservas: [{ id: 'r', ejemplarId: 'otro' }],
    });
    expect((await service.previewCategoryDeletion(categoryId)).canDelete).toBe(
      true,
    );
    db.rows('reservas')[0].ejemplarId = copyId;
    await expect(service.deleteCategory(categoryId)).rejects.toMatchObject({
      status: 409,
    });
    expect(db.rows('ejemplares')).toHaveLength(1);
  });

  it('rollback total cuando falla la auditoría después del borrado', async () => {
    const { service, db } = setup();
    db.failAudit();
    await expect(
      service.mutate(actor, 'INVENTARIO_CATEGORIA_ELIMINADA', (s) =>
        s.deleteCategory(categoryId),
      ),
    ).rejects.toThrow('audit unavailable');
    expect(db.rows('categorias_recurso')).toHaveLength(1);
    expect(db.rows('recursos')).toHaveLength(1);
    expect(db.rows('ejemplares')).toHaveLength(1);
    expect(db.rows('auditorias_usuario')).toHaveLength(0);
  });

  it('revierte los hijos ya borrados si falla una restricción al borrar el recurso', async () => {
    const { service, db } = setup();
    const runtime = db.client.runtime();
    const original = runtime.query.bind(runtime);
    vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
      if (plan.operation === 'delete' && plan.table === 'recursos')
        throw Object.assign(new Error('foreign key interna'), {
          code: '23503',
        });
      return original(plan);
    });
    await expect(service.deleteCategory(categoryId)).rejects.toMatchObject({
      status: 409,
    });
    expect(db.rows('categorias_recurso')).toHaveLength(1);
    expect(db.rows('recursos')).toHaveLength(1);
    expect(db.rows('ejemplares')).toHaveLength(1);
    expect(
      db.calls.some(
        (plan) => plan.operation === 'delete' && plan.table === 'ejemplares',
      ),
    ).toBe(true);
  });

  it.each(['23503', '55P03', '40P01', '40001'])(
    'traduce conflicto %s sin exponer el error referencial',
    async (code) => {
      const { service, db } = setup();
      const original = db.client.runtime().query.bind(db.client.runtime());
      vi.spyOn(db.client.runtime(), 'query').mockImplementation(
        async (plan) => {
          if (plan.operation === 'lock')
            throw Object.assign(new Error('detalle interno'), {
              cause: { code },
            });
          return original(plan);
        },
      );
      await expect(service.deleteCategory(categoryId)).rejects.toMatchObject({
        status: 409,
      });
      expect(db.rows('ejemplares')).toHaveLength(1);
    },
  );

  it('lee matrices publicadas sin heredar a una categoría nueva ni inferir por nombre', async () => {
    const { service, db } = setup(categoryPolicyFixture(categoryId));
    const configuration = await service.getCategoryPolicies(categoryId);
    expect(configuration).toMatchObject({
      status: 'COMPLETE',
      eligibleForNewOperations: true,
      rulesEditable: false,
    });
    expect(
      configuration.policies
        .filter((p) => p.kind === 'LATENESS')
        .map((p) => p.severity),
    ).toEqual(['LEVE', 'MODERADA', 'GRAVE']);
    expect(
      configuration.policies.find((p) => p.kind === 'TRUST')?.criteria.trust
        ?.levels,
    ).toHaveLength(4);
    const created = await service.createCategory({
      nombre: 'Otros libros',
      tiempoMaximoPrestamoDias: 2,
    });
    expect(await service.getCategoryPolicies(created.id)).toMatchObject({
      status: 'INCOMPLETE',
      eligibleForNewOperations: false,
    });
    const before = JSON.stringify(db.rows('versiones_regla'));
    await service.updateCategory(categoryId, {
      nombre: 'Renombrada',
      tiempoMaximoPrestamoHoras: 8,
    });
    expect((await service.getCategoryPolicies(categoryId)).status).toBe(
      'COMPLETE',
    );
    expect(JSON.stringify(db.rows('versiones_regla'))).toBe(before);
    db.rows('versiones_regla')[9].estado = 'INACTIVA';
    expect(
      (await service.getCategoryPolicies(categoryId)).eligibleForNewOperations,
    ).toBe(false);
  });

  it.each(['category', 'resource', 'incomplete'])(
    'rechaza reserva transaccional si %s no permite nuevas operaciones',
    async (reason) => {
      const { db, reservations } = setup({
        ...categoryPolicyFixture(categoryId),
        usuarios: [{ id: 'u', vinculacionVigente: true }],
      });
      if (reason === 'category')
        db.rows('categorias_recurso')[0].activo = false;
      if (reason === 'resource') db.rows('recursos')[0].activo = false;
      if (reason === 'incomplete')
        db.rows('reglas_uso')[6].versionVigenteId = null;
      await expect(
        reservations.create({
          userId: 'u',
          copyId,
          requestedAt: new Date(),
          loanDurationHours: 48,
          enforceSingleOpenOperation: false,
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(db.rows('ejemplares')[0].estado).toBe('DISPONIBLE');
      expect(db.rows('reservas')).toHaveLength(0);
    },
  );

  it('no declara completa una política sin restricciones de acceso estructuradas', async () => {
    const { service, db } = setup(categoryPolicyFixture(categoryId));
    const access = db.rows('versiones_regla').find((row) => {
      const data = JSON.parse(row.descripcion);
      return data.kind === 'ACCESS' && data.categoryId === categoryId;
    })!;
    const metadata = JSON.parse(access.descripcion);
    delete metadata.criteria.access;
    access.descripcion = JSON.stringify(metadata);
    expect(await service.getCategoryPolicies(categoryId)).toMatchObject({
      status: 'INCOMPLETE',
      eligibleForNewOperations: false,
    });
  });
});
