import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import { PrismaInventoryRepository } from './prisma-inventory.repository.js';

describe('PrismaInventoryRepository (PostgreSQL)', () => {
  let prisma: PrismaService;
  let repository: PrismaInventoryRepository;
  let categoryId: string;
  let resourceId: string;
  let copyIds: string[];
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    repository = new PrismaInventoryRepository(prisma);

    const category = await repository.createCategory({
      nombre: `Integración ${suffix}`,
      tiempoMaximoPrestamoDias: 14,
    });
    categoryId = category.id;
    const resource = await repository.createResource({
      categoriaId: categoryId,
      nombre: `Recurso ${suffix}`,
      descripcion: 'Persistencia real',
    });
    resourceId = resource.id;
    copyIds = await Promise.all([
      repository.createCopy({
        recursoId: resourceId,
        codigoInventario: `INT-D-${suffix}`,
        estado: 'DISPONIBLE',
      }),
      repository.createCopy({
        recursoId: resourceId,
        codigoInventario: `INT-P-${suffix}`,
        estado: 'PRESTADO',
      }),
      repository.createCopy({
        recursoId: resourceId,
        codigoInventario: `INT-N-${suffix}`,
        estado: 'NO_DISPONIBLE',
      }),
    ]).then((copies) => copies.map((copy) => copy.id));
  });

  it('persists categories, resources and their relationship', async () => {
    await expect(repository.findCategoryById(categoryId)).resolves.toMatchObject({
      id: categoryId,
      nombre: `Integración ${suffix}`,
    });
    await expect(repository.findResourceById(resourceId)).resolves.toMatchObject({
      id: resourceId,
      categoriaId: categoryId,
      nombre: `Recurso ${suffix}`,
      descripcion: 'Persistencia real',
    });
    await expect(repository.findCopiesByResource(resourceId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recursoId: resourceId }),
      ]),
    );
  });

  it('returns availability counts by real state', async () => {
    await expect(
      repository.countCopiesByResourceAndState(resourceId, 'DISPONIBLE'),
    ).resolves.toBe(1);
    await expect(
      repository.countCopiesByResourceAndState(resourceId, 'PRESTADO'),
    ).resolves.toBe(1);
    await expect(
      repository.countCopiesByResourceAndState(resourceId, 'NO_DISPONIBLE'),
    ).resolves.toBe(1);
  });

  it('enforces duplicate category names in PostgreSQL', async () => {
    await expect(
      repository.createCategory({
        nombre: `Integración ${suffix}`,
        tiempoMaximoPrestamoDias: 14,
      }),
    ).rejects.toSatisfy((error: any) =>
      error?.code === '23505' || error?.cause?.code === '23505',
    );
  });

  it('enforces resource/category restrict deletes in PostgreSQL', async () => {
    await expect(repository.deleteCategory(categoryId)).rejects.toThrow();
    await expect(repository.deleteResource(resourceId)).rejects.toThrow();
  });

  afterAll(async () => {
    for (const copyId of copyIds ?? []) {
      await repository.deleteCopy(copyId);
    }
    if (resourceId) {
      await repository.deleteResource(resourceId);
    }
    if (categoryId) {
      await repository.deleteCategory(categoryId);
    }
    await prisma?.onModuleDestroy();
  });
});
