import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { inMemoryPrisma } from '../../../../../test/helpers/in-memory-prisma.js';
import { PrismaInventoryRepository } from '../../infrastructure/persistence/prisma/prisma-inventory.repository.js';
import { InventoryService } from './inventory.service.js';

const actor = { accountId: 'staff-account', userId: 'staff-user' };
const categoryId = '123e4567-e89b-42d3-a456-426614174000';
const resourceId = '123e4567-e89b-42d3-a456-426614174001';
const copyId = '123e4567-e89b-42d3-a456-426614174002';
const initial = {
  categorias_recurso: [
    {
      id: categoryId,
      nombre: 'Libros',
      tiempoMaximoPrestamoDias: 7,
      tiempoMaximoPrestamoHoras: 168,
    },
  ],
  recursos: [
    {
      id: resourceId,
      categoriaId: categoryId,
      nombre: 'Algoritmos',
      descripcion: null,
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
const setup = (extra = {}) => {
  const db = inMemoryPrisma({ ...initial, ...extra });
  const service = new InventoryService(
    new PrismaInventoryRepository(db as any),
  );
  return {
    db,
    service,
    write: <T>(work: (service: InventoryService) => Promise<T>) =>
      service.mutate(actor, 'INVENTARIO_TEST', work),
  };
};

describe('Inventory CRUD without database', () => {
  it('creates, reads, lists, edits and deletes unreferenced categories and resources', async () => {
    const { service, write, db } = setup();
    const category = await write((s) =>
      s.createCategory({ nombre: ' Equipos ', tiempoMaximoPrestamoDias: 1 }),
    );
    await write((s) =>
      s.updateCategory(category.id, {
        nombre: 'Equipos nuevos',
        tiempoMaximoPrestamoHoras: 4,
      }),
    );
    expect(await service.getCategory(category.id)).toMatchObject({
      nombre: 'Equipos nuevos',
      tiempoMaximoPrestamoHoras: 4,
    });
    expect(await service.listCategories()).toHaveLength(2);
    const resource = await write((s) =>
      s.createResource({
        categoriaId: category.id,
        nombre: ' Laptop ',
        descripcion: null,
      }),
    );
    await write((s) =>
      s.updateResource(resource.id, { nombre: 'Laptop nueva' }),
    );
    expect(await service.getResource(resource.id)).toMatchObject({
      nombre: 'Laptop nueva',
    });
    expect((await service.listResources()).total).toBe(2);
    await expect(write((s) => s.deleteCategory(category.id))).rejects.toThrow(
      ConflictException,
    );
    await write((s) => s.deleteResource(resource.id));
    await write((s) => s.deleteCategory(category.id));
    expect(db.rows('auditorias_usuario')).toHaveLength(6);
    expect(
      JSON.parse(db.rows('auditorias_usuario')[0].datosNuevos).actor,
    ).toEqual(actor);
  });

  it('edits and deactivates copies preserving observations, reservations and loan history', async () => {
    const history = [{ id: 'loan', ejemplarId: copyId, estado: 'FINALIZADO' }];
    const reservations = [
      { id: 'reservation', ejemplarId: copyId, estado: 'CANCELADA' },
    ];
    const observations = [
      { id: 'note', ejemplarId: copyId, descripcion: 'Historial' },
    ];
    const { service, write, db } = setup({
      prestamos: history,
      reservas: reservations,
      observaciones_ejemplar: observations,
    });
    const created = await write((s) =>
      s.createCopy(resourceId, { codigoInventario: 'LIB-2' }),
    );
    expect(await service.listCopiesByResource(resourceId)).toHaveLength(2);
    expect(await service.getCopy(created.id)).toMatchObject({
      codigoInventario: 'LIB-2',
    });
    await write((s) => s.updateCopy(copyId, { codigoInventario: 'LIB-3' }));
    await write((s) =>
      s.createObservation(copyId, { descripcion: 'Nota nueva' }),
    );
    expect(await service.listObservationsByCopy(copyId)).toHaveLength(2);
    expect(await write((s) => s.deleteCopy(copyId))).toEqual({
      deleted: false,
      deactivated: true,
      copyId,
      estado: 'NO_DISPONIBLE',
    });
    expect(await service.getLoanAvailability(copyId)).toMatchObject({
      available: false,
    });
    expect(db.rows('prestamos')).toEqual(history);
    expect(db.rows('reservas')).toEqual(reservations);
    expect(db.rows('observaciones_ejemplar')[0]).toEqual(observations[0]);
    expect(db.rows('ejemplares')).toHaveLength(2);
    await expect(write((s) => s.deleteResource(resourceId))).rejects.toThrow(
      ConflictException,
    );
    await write((s) => s.updateCopyState(copyId, { estado: 'DISPONIBLE' }));
    expect(await service.getLoanAvailability(copyId)).toMatchObject({
      available: true,
    });
    expect(
      db.calls.some(
        (call) => call.table === 'ejemplares' && call.operation === 'delete',
      ),
    ).toBe(false);
  });

  it.each(['PRESTADO', 'RESERVADO', 'PLANIFICADO', 'CONFIRMADA'])(
    'rejects copy changes and deactivation with %s',
    async (state) => {
      const extra =
        state === 'PLANIFICADO'
          ? {
              prestamos: [{ id: 'planned', ejemplarId: copyId, estado: state }],
            }
          : state === 'CONFIRMADA'
            ? { reservas: [{ id: 'open', ejemplarId: copyId, estado: state }] }
            : { ejemplares: [{ ...initial.ejemplares[0], estado: state }] };
      const { write, db } = setup(extra);
      await expect(
        write((s) => s.updateCopy(copyId, { codigoInventario: 'changed' })),
      ).rejects.toThrow(ConflictException);
      await expect(
        write((s) => s.updateCopyState(copyId, { estado: 'NO_DISPONIBLE' })),
      ).rejects.toThrow(ConflictException);
      await expect(write((s) => s.deleteCopy(copyId))).rejects.toThrow(
        ConflictException,
      );
      expect(db.rows('ejemplares')[0].codigoInventario).toBe('LIB-1');
      expect(db.rows('auditorias_usuario')).toHaveLength(0);
    },
  );

  it('rolls back the inventory change if audit fails and rejects duplicates', async () => {
    const { write, db } = setup();
    await expect(
      write((s) =>
        s.createCategory({ nombre: 'Libros', tiempoMaximoPrestamoDias: 2 }),
      ),
    ).rejects.toThrow(ConflictException);
    db.failAudit();
    await expect(
      write((s) => s.updateCopy(copyId, { codigoInventario: 'changed' })),
    ).rejects.toThrow('audit unavailable');
    expect(db.rows('ejemplares')).toEqual(initial.ejemplares);
  });
});
