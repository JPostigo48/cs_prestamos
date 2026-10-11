import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from './inventory.service.js';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

describe('InventoryService', () => {
  const categoryId = '123e4567-e89b-42d3-a456-426614174000';
  const resourceId = '123e4567-e89b-42d3-a456-426614174001';
  const copyId = '123e4567-e89b-42d3-a456-426614174002';

  let service: InventoryService;
  let repository: {
    createCategory: ReturnType<typeof vi.fn>;
    findCategoryById: ReturnType<typeof vi.fn>;
    findAllCategories: ReturnType<typeof vi.fn>;
    countResourcesByCategory: ReturnType<typeof vi.fn>;
    createResource: ReturnType<typeof vi.fn>;
    findResourceById: ReturnType<typeof vi.fn>;
    findAllResources: ReturnType<typeof vi.fn>;
    countCopiesByResource: ReturnType<typeof vi.fn>;
    countAvailableCopiesByResource: ReturnType<typeof vi.fn>;
    countCopiesByResourceAndState: ReturnType<typeof vi.fn>;
    countResources: ReturnType<typeof vi.fn>;
    createCopy: ReturnType<typeof vi.fn>;
    findCopyById: ReturnType<typeof vi.fn>;
    updateCopyState: ReturnType<typeof vi.fn>;
    createObservation: ReturnType<typeof vi.fn>;
    findObservationsByCopy: ReturnType<typeof vi.fn>;
    deleteCategory: ReturnType<typeof vi.fn>;
    deleteResource: ReturnType<typeof vi.fn>;
    deleteCopy: ReturnType<typeof vi.fn>;
    updateCategory: ReturnType<typeof vi.fn>;
    updateResource: ReturnType<typeof vi.fn>;
    findCopiesByResource: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repository = {
      createCategory: vi.fn(),
      findCategoryById: vi.fn(),
      findAllCategories: vi.fn(),
      countResourcesByCategory: vi.fn(),
      createResource: vi.fn(),
      findResourceById: vi.fn(),
      findAllResources: vi.fn(),
      countCopiesByResource: vi.fn(),
      countAvailableCopiesByResource: vi.fn(),
      countCopiesByResourceAndState: vi
        .fn()
        .mockImplementation((_resourceId, state) =>
          Promise.resolve(state === 'DISPONIBLE' ? 1 : 0),
        ),
      countResources: vi.fn().mockResolvedValue(1),
      createCopy: vi.fn(),
      findCopyById: vi.fn(),
      updateCopyState: vi.fn(),
      createObservation: vi.fn(),
      findObservationsByCopy: vi.fn(),
      deleteCategory: vi.fn(),
      deleteResource: vi.fn(),
      deleteCopy: vi.fn(),
      updateCategory: vi.fn(),
      updateResource: vi.fn(),
      findCopiesByResource: vi.fn(),
    };

    service = new InventoryService(repository as any);
  });

  it('should create a category correctly', async () => {
    repository.createCategory.mockResolvedValue({
      id: categoryId,
      nombre: 'Libros',
      tiempoMaximoPrestamoDias: 14,
      resourceCount: 0,
    });

    const result = await service.createCategory({
      nombre: ' Libros ',
      tiempoMaximoPrestamoDias: 14,
    });

    expect(repository.createCategory).toHaveBeenCalledWith({
      nombre: 'Libros',
      tiempoMaximoPrestamoDias: 14,
    });
    expect(result.nombre).toBe('Libros');
  });

  it('should reject invalid loan days', async () => {
    await expect(
      service.createCategory({ nombre: 'Libros', tiempoMaximoPrestamoDias: 0 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject duplicate category names', async () => {
    repository.createCategory.mockRejectedValue(
      new ConflictException('Categoría duplicada'),
    );

    await expect(
      service.createCategory({
        nombre: 'Libros',
        tiempoMaximoPrestamoDias: 14,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should create a resource with an existing category', async () => {
    repository.findCategoryById.mockResolvedValue({
      id: categoryId,
      nombre: 'Libros',
    });
    repository.createResource.mockResolvedValue({
      id: resourceId,
      categoriaId: categoryId,
      nombre: 'Clean Code',
    });

    const result = await service.createResource({
      categoriaId: categoryId,
      nombre: ' Clean Code ',
      descripcion: 'Libro',
    });

    expect(repository.createResource).toHaveBeenCalledWith({
      categoriaId: categoryId,
      nombre: 'Clean Code',
      descripcion: 'Libro',
    });
    expect(result.nombre).toBe('Clean Code');
  });

  it('should reject resource creation when category does not exist', async () => {
    repository.findCategoryById.mockResolvedValue(null);

    await expect(
      service.createResource({
        categoriaId: '123e4567-e89b-42d3-a456-426614174999',
        nombre: 'Clean Code',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create a copy as AVAILABLE', async () => {
    repository.findResourceById.mockResolvedValue({
      id: resourceId,
      nombre: 'Clean Code',
    });
    repository.createCopy.mockResolvedValue({
      id: copyId,
      recursoId: resourceId,
      codigoInventario: 'LIB-001',
      estado: 'DISPONIBLE',
    });

    const result = await service.createCopy(resourceId, {
      codigoInventario: 'LIB-001',
    });

    expect(repository.createCopy).toHaveBeenCalledWith({
      recursoId: resourceId,
      codigoInventario: 'LIB-001',
      estado: 'DISPONIBLE',
    });
    expect(result.estado).toBe('DISPONIBLE');
  });

  it('should reject duplicated inventory code', async () => {
    repository.findResourceById.mockResolvedValue({ id: resourceId });
    repository.createCopy.mockRejectedValue(
      new ConflictException('Código duplicado'),
    );

    await expect(
      service.createCopy(resourceId, { codigoInventario: 'LIB-001' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject direct PRESTADO transition from inventory', async () => {
    repository.findCopyById.mockResolvedValue({
      id: copyId,
      estado: 'DISPONIBLE',
    });

    await expect(
      service.updateCopyState(copyId, { estado: 'PRESTADO' as any }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('should calculate availability', async () => {
    repository.findResourceById.mockResolvedValue({ id: resourceId });
    repository.countCopiesByResourceAndState.mockImplementation(
      (_id, state) =>
        Promise.resolve(
          state === 'DISPONIBLE' ? 2 : state === 'PRESTADO' ? 1 : 3,
        ),
    );

    const result = await service.getResourceAvailability(resourceId);

    expect(result.available).toBe(true);
    expect(result.totalCopies).toBe(6);
    expect(result.disponibles).toBe(2);
    expect(result.prestados).toBe(1);
    expect(result.noDisponibles).toBe(3);
  });

  it('should reject category deletion when resources exist', async () => {
    repository.findCategoryById.mockResolvedValue({ id: categoryId });
    repository.countResourcesByCategory.mockResolvedValue(1);

    await expect(service.deleteCategory(categoryId)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should reject resource deletion when copies exist', async () => {
    repository.findResourceById.mockResolvedValue({ id: resourceId });
    repository.countCopiesByResource.mockResolvedValue(1);

    await expect(service.deleteResource(resourceId)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should create an observation correctly', async () => {
    repository.findCopyById.mockResolvedValue({ id: copyId });
    repository.createObservation.mockResolvedValue({
      id: 'obs-1',
      ejemplarId: copyId,
      descripcion: 'Desgaste',
    });

    const result = await service.createObservation(copyId, {
      descripcion: ' Desgaste ',
    });

    expect(repository.createObservation).toHaveBeenCalledWith({
      ejemplarId: copyId,
      descripcion: 'Desgaste',
    });
    expect(result.descripcion).toBe('Desgaste');
  });

  it('should reject empty observation', async () => {
    repository.findCopyById.mockResolvedValue({
      id: copyId,
      estado: 'DISPONIBLE',
    });

    await expect(
      service.createObservation(copyId, { descripcion: '   ' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('translates a postgres unique violation and preserves unexpected errors', async () => {
    repository.createCategory.mockRejectedValue({ code: '23505' });
    await expect(
      service.createCategory({ nombre: 'Libros', tiempoMaximoPrestamoDias: 14 }),
    ).rejects.toThrow(ConflictException);

    const error = new Error('database unavailable');
    repository.createResource.mockRejectedValue(error);
    repository.findCategoryById.mockResolvedValue({ id: categoryId });
    await expect(
      service.createResource({ categoriaId: categoryId, nombre: 'Libro' }),
    ).rejects.toBe(error);

    repository.createCopy.mockRejectedValue({ code: '23505' });
    repository.findResourceById.mockResolvedValue({ id: resourceId });
    await expect(
      service.createCopy(resourceId, { codigoInventario: 'LIB-001' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects deletes when the row disappears after the existence check', async () => {
    repository.findCategoryById.mockResolvedValue({ id: categoryId });
    repository.countResourcesByCategory.mockResolvedValue(0);
    repository.deleteCategory.mockResolvedValue(0);
    await expect(service.deleteCategory(categoryId)).rejects.toThrow(
      NotFoundException,
    );

    repository.findResourceById.mockResolvedValue({ id: resourceId });
    repository.countCopiesByResource.mockResolvedValue(0);
    repository.deleteResource.mockResolvedValue(0);
    await expect(service.deleteResource(resourceId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('gets a category and maps its resource count', async () => {
    repository.findCategoryById.mockResolvedValue({
      id: categoryId,
      nombre: 'Libros',
      tiempoMaximoPrestamoDias: 14,
    });
    repository.countResourcesByCategory.mockResolvedValue(3);
    await expect(service.getCategory(categoryId)).resolves.toMatchObject({
      id: categoryId,
      resourceCount: 3,
    });
    repository.findCategoryById.mockResolvedValue(null);
    await expect(service.getCategory(categoryId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates a category partially and validates category fields', async () => {
    repository.findCategoryById.mockResolvedValue({ id: categoryId });
    repository.updateCategory.mockResolvedValue({
      id: categoryId,
      nombre: 'Nuevo',
      tiempoMaximoPrestamoDias: 21,
    });
    await service.updateCategory(categoryId, { nombre: ' Nuevo ' });
    expect(repository.updateCategory).toHaveBeenCalledWith(categoryId, {
      nombre: 'Nuevo',
    });
    await expect(
      service.updateCategory('invalid', {}),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.updateCategory(categoryId, { tiempoMaximoPrestamoDias: 0 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps category counts when listing categories', async () => {
    repository.findAllCategories.mockResolvedValue([
      { id: categoryId, nombre: 'Libros', tiempoMaximoPrestamoDias: 14 },
    ]);
    repository.countResourcesByCategory.mockResolvedValue(2);
    await expect(service.listCategories()).resolves.toEqual([
      expect.objectContaining({ id: categoryId, resourceCount: 2 }),
    ]);
  });

  it('gets a resource with its category and rejects missing resources', async () => {
    repository.findResourceById.mockResolvedValue({
      id: resourceId,
      categoriaId: categoryId,
      nombre: 'Libro',
    });
    repository.findCategoryById.mockResolvedValue({ id: categoryId, nombre: 'Libros' });
    repository.countCopiesByResource.mockResolvedValue(2);
    repository.countAvailableCopiesByResource.mockResolvedValue(1);
    await expect(service.getResource(resourceId)).resolves.toMatchObject({
      id: resourceId,
      available: true,
      categoria: expect.objectContaining({ id: categoryId }),
    });
    repository.findResourceById.mockResolvedValue(null);
    await expect(service.getResource(resourceId)).rejects.toThrow(NotFoundException);
  });

  it('updates resources and validates destination categories', async () => {
    repository.findResourceById.mockResolvedValue({ id: resourceId });
    repository.findCategoryById.mockResolvedValue({ id: categoryId });
    repository.updateResource.mockResolvedValue({
      id: resourceId,
      categoriaId: categoryId,
      nombre: 'Nuevo',
    });
    await service.updateResource(resourceId, { categoriaId: categoryId });
    expect(repository.updateResource).toHaveBeenCalledWith(resourceId, {
      categoriaId: categoryId,
    });
    await expect(
      service.updateResource(resourceId, { categoriaId: 'invalid' }),
    ).rejects.toThrow(BadRequestException);
    repository.findCategoryById.mockResolvedValue(null);
    await expect(
      service.updateResource(resourceId, { categoriaId: categoryId }),
    ).rejects.toThrow(NotFoundException);
    repository.findResourceById.mockResolvedValue(null);
    await expect(service.updateResource(resourceId, {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('translates duplicate resource names on update', async () => {
    repository.findResourceById.mockResolvedValue({ id: resourceId });
    repository.updateResource.mockRejectedValue({ code: '23505' });
    await expect(
      service.updateResource(resourceId, { nombre: 'Repetido' }),
    ).rejects.toThrow(ConflictException);
  });

  it.each([
    [{ categoryId }, { categoryId }],
    [{ available: 'true' }, { available: true }],
    [{ available: 'false' }, { available: false }],
    [{ search: 'code' }, { search: 'code' }],
  ])('lists resources with filter %j', async (filter, expected) => {
    repository.findAllResources.mockResolvedValue([
      { id: resourceId, categoriaId: categoryId },
    ]);
    repository.findCategoryById.mockResolvedValue({
      id: categoryId,
      nombre: 'Libros',
    });
    repository.countCopiesByResourceAndState.mockImplementation(
      (_id, state) =>
        Promise.resolve(
          state === 'DISPONIBLE' && expected.available !== false ? 1 : 0,
        ),
    );
    await service.listResources({ ...filter, page: 1, limit: 20 });
    const expectedQuery =
      expected.available === undefined
        ? { ...expected, limit: 20, offset: 0 }
        : expected;
    expect(repository.findAllResources).toHaveBeenCalledWith(
      expect.objectContaining(expectedQuery),
    );
  });

  it('returns paginated resources with embedded category and metadata', async () => {
    repository.findAllResources.mockResolvedValue([
      { id: resourceId, categoriaId: categoryId, nombre: 'Libro' },
    ]);
    repository.findCategoryById.mockResolvedValue({
      id: categoryId,
      nombre: 'Libros',
    });
    repository.countResources.mockResolvedValue(4);
    const result = await service.listResources({ page: 2, limit: 1 });
    expect(result).toMatchObject({ page: 2, limit: 1, total: 4 });
    expect(result.data[0].categoria).toEqual({
      id: categoryId,
      nombre: 'Libros',
    });
  });

  it('returns global availability for all resources', async () => {
    repository.findAllResources.mockResolvedValue([
      { id: resourceId, categoriaId: categoryId, nombre: 'Libro' },
    ]);
    repository.findCategoryById.mockResolvedValue({
      id: categoryId,
      nombre: 'Libros',
    });
    repository.countCopiesByResourceAndState.mockImplementation(
      (_id, state) =>
        Promise.resolve(
          state === 'DISPONIBLE' ? 1 : state === 'PRESTADO' ? 2 : 3,
        ),
    );
    const result = await service.getGlobalAvailability();
    expect(result[0]).toMatchObject({
      id: resourceId,
      disponibles: 1,
      prestados: 2,
      noDisponibles: 3,
    });
  });

  it('gets copies, observations and lists copies by resource', async () => {
    repository.findCopyById.mockResolvedValue({
      id: copyId,
      recursoId: resourceId,
      codigoInventario: 'LIB-001',
      estado: 'DISPONIBLE',
    });
    repository.findResourceById.mockResolvedValue({
      id: resourceId,
      nombre: 'Libro',
      categoriaId: categoryId,
    });
    repository.findObservationsByCopy.mockResolvedValue([
      { id: 'obs-1', ejemplarId: copyId, descripcion: 'Desgaste' },
    ]);
    await expect(service.getCopy(copyId)).resolves.toMatchObject({
      id: copyId,
      observaciones: [expect.objectContaining({ descripcion: 'Desgaste' })],
    });
    repository.findCopiesByResource.mockResolvedValue([
      { id: copyId, recursoId: resourceId, codigoInventario: 'LIB-001', estado: 'DISPONIBLE' },
    ]);
    await expect(service.listCopiesByResource(resourceId)).resolves.toHaveLength(1);
    repository.findCopyById.mockResolvedValue(null);
    await expect(service.getCopy(copyId)).rejects.toThrow(NotFoundException);
  });

  it('deletes a copy and detects a concurrent deletion', async () => {
    repository.findCopyById.mockResolvedValue({ id: copyId });
    repository.deleteCopy.mockResolvedValue(1);
    await expect(service.deleteCopy(copyId)).resolves.toEqual({
      deleted: true,
      copyId,
    });
    repository.deleteCopy.mockResolvedValue(0);
    await expect(service.deleteCopy(copyId)).rejects.toThrow(NotFoundException);
  });

  it.each(['DISPONIBLE', 'NO_DISPONIBLE'] as const)(
    'updates copy state to %s',
    async (state) => {
      repository.findCopyById.mockResolvedValue({ id: copyId, estado: state === 'DISPONIBLE' ? 'NO_DISPONIBLE' : 'DISPONIBLE' });
      repository.updateCopyState.mockResolvedValue({ id: copyId, estado: state });
      await expect(
        service.updateCopyState(copyId, { estado: state }),
      ).resolves.toMatchObject({ estado: state });
    },
  );

  it('rejects an unmanaged copy state', async () => {
    repository.findCopyById.mockResolvedValue({ id: copyId, estado: 'DISPONIBLE' });
    await expect(
      service.updateCopyState(copyId, { estado: 'DESCONOCIDO' as any }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('lists observations by copy', async () => {
    repository.findCopyById.mockResolvedValue({ id: copyId });
    repository.findObservationsByCopy.mockResolvedValue([
      { id: 'obs-1', ejemplarId: copyId, descripcion: 'Nota' },
    ]);
    await expect(service.listObservationsByCopy(copyId)).resolves.toEqual([
      expect.objectContaining({ descripcion: 'Nota' }),
    ]);
  });

  it.each([
    ['getCategory', () => service.getCategory('bad')],
    ['updateCategory', () => service.updateCategory('bad', {})],
    ['getResource', () => service.getResource('bad')],
    ['updateResource', () => service.updateResource('bad', {})],
    ['deleteResource', () => service.deleteResource('bad')],
    ['createCopy', () => service.createCopy('bad', { codigoInventario: 'x' })],
    ['listCopiesByResource', () => service.listCopiesByResource('bad')],
    ['deleteCopy', () => service.deleteCopy('bad')],
    ['getCopy', () => service.getCopy('bad')],
    ['updateCopyState', () => service.updateCopyState('bad', { estado: 'DISPONIBLE' })],
    ['getResourceAvailability', () => service.getResourceAvailability('bad')],
    ['createObservation', () => service.createObservation('bad', { descripcion: 'x' })],
    ['listObservationsByCopy', () => service.listObservationsByCopy('bad')],
  ])('rejects invalid UUIDs in %s', async (_name, operation) => {
    await expect(operation()).rejects.toThrow(BadRequestException);
  });
});
