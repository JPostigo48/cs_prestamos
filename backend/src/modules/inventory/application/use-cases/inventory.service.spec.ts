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
    createCopy: ReturnType<typeof vi.fn>;
    findCopyById: ReturnType<typeof vi.fn>;
    updateCopyState: ReturnType<typeof vi.fn>;
    createObservation: ReturnType<typeof vi.fn>;
    findObservationsByCopy: ReturnType<typeof vi.fn>;
    deleteCategory: ReturnType<typeof vi.fn>;
    deleteResource: ReturnType<typeof vi.fn>;
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
      createCopy: vi.fn(),
      findCopyById: vi.fn(),
      updateCopyState: vi.fn(),
      createObservation: vi.fn(),
      findObservationsByCopy: vi.fn(),
      deleteCategory: vi.fn(),
      deleteResource: vi.fn(),
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
    repository.countCopiesByResource.mockResolvedValue(3);
    repository.countAvailableCopiesByResource.mockResolvedValue(2);

    const result = await service.getResourceAvailability(resourceId);

    expect(result.available).toBe(true);
    expect(result.totalCopies).toBe(3);
    expect(result.availableCopies).toBe(2);
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
});
