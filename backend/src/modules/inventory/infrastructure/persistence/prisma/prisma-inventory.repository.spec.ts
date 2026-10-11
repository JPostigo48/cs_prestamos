import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaInventoryRepository } from './prisma-inventory.repository.js';

describe('PrismaInventoryRepository', () => {
  const query = { sql: 'QUERY' };
  let repository: PrismaInventoryRepository;
  let runtime: { query: ReturnType<typeof vi.fn>; execute: ReturnType<typeof vi.fn> };
  let builders: Record<string, any>;
  let prisma: any;

  beforeEach(() => {
    runtime = {
      query: vi.fn().mockResolvedValue([{ id: 'row-1' }]),
      execute: vi.fn().mockResolvedValue({ count: 1 }),
    };
    builders = {};
    const table = (name: string) => {
      const builder = {
        select: vi.fn().mockImplementation(() => builder),
        insert: vi.fn().mockImplementation(() => builder),
        update: vi.fn().mockImplementation(() => builder),
        delete: vi.fn().mockImplementation(() => builder),
        where: vi.fn().mockImplementation(() => builder),
        limit: vi.fn().mockImplementation(() => builder),
        offset: vi.fn().mockImplementation(() => builder),
        returning: vi.fn().mockImplementation(() => builder),
        build: vi.fn().mockReturnValue(query),
      };
      builders[name] = builder;
      return builder;
    };
    prisma = {
      sql: {
        public: {
          categorias_recurso: table('categorias_recurso'),
          recursos: table('recursos'),
          ejemplares: table('ejemplares'),
          observaciones_ejemplar: table('observaciones_ejemplar'),
        },
      },
      client: { runtime: vi.fn().mockReturnValue(runtime) },
    };
    repository = new PrismaInventoryRepository(prisma);
  });

  it.each([
    ['createCategory', () => repository.createCategory({ nombre: 'Libros', tiempoMaximoPrestamoDias: 14 }), 'categorias_recurso', 'insert', 'query'],
    ['findCategoryById', () => repository.findCategoryById('cat-1'), 'categorias_recurso', 'select', 'query'],
    ['updateCategory', () => repository.updateCategory('cat-1', { nombre: 'Nuevo' }), 'categorias_recurso', 'update', 'query'],
    ['countResourcesByCategory', () => repository.countResourcesByCategory('cat-1'), 'recursos', 'select', 'query'],
    ['createResource', () => repository.createResource({ categoriaId: 'cat-1', nombre: 'Libro' }), 'recursos', 'insert', 'query'],
    ['findResourceById', () => repository.findResourceById('resource-1'), 'recursos', 'select', 'query'],
    ['updateResource', () => repository.updateResource('resource-1', { nombre: 'Nuevo' }), 'recursos', 'update', 'query'],
    ['countCopiesByResource', () => repository.countCopiesByResource('resource-1'), 'ejemplares', 'select', 'query'],
    ['countAvailableCopiesByResource', () => repository.countAvailableCopiesByResource('resource-1'), 'ejemplares', 'select', 'query'],
    ['createCopy', () => repository.createCopy({ recursoId: 'resource-1', codigoInventario: 'LIB-1' }), 'ejemplares', 'insert', 'query'],
    ['findCopiesByResource', () => repository.findCopiesByResource('resource-1'), 'ejemplares', 'select', 'query'],
    ['findCopyById', () => repository.findCopyById('copy-1'), 'ejemplares', 'select', 'query'],
    ['updateCopyState', () => repository.updateCopyState('copy-1', 'DISPONIBLE'), 'ejemplares', 'update', 'query'],
    ['createObservation', () => repository.createObservation({ ejemplarId: 'copy-1', descripcion: 'Nota' }), 'observaciones_ejemplar', 'insert', 'query'],
    ['findObservationsByCopy', () => repository.findObservationsByCopy('copy-1'), 'observaciones_ejemplar', 'select', 'query'],
  ])('builds and executes %s through query', async (_name, operation, table, builderMethod, runtimeMethod) => {
    await operation();
    expect(builders[table][builderMethod]).toHaveBeenCalled();
    expect(builders[table].build).toHaveBeenCalled();
    expect(runtime[runtimeMethod]).toHaveBeenCalledWith(query);
  });

  it('deletes a copy and returns affected rows', async () => {
    await expect(repository.deleteCopy('copy-1')).resolves.toBe(1);
    expect(builders.ejemplares.delete).toHaveBeenCalled();
    expect(runtime.query).toHaveBeenCalledWith(query);
  });

  it.each([
    ['deleteCategory', () => repository.deleteCategory('cat-1'), 'categorias_recurso'],
    ['deleteResource', () => repository.deleteResource('resource-1'), 'recursos'],
  ])('normalizes affected rows for %s', async (_name, operation, table) => {
    await expect(operation()).resolves.toBe(1);
    expect(builders[table].delete).toHaveBeenCalled();
    expect(runtime.query).toHaveBeenCalledWith(query);
  });

  it('adds category and search predicates to resource listing', async () => {
    await repository.findAllResources({
      categoryId: 'cat-1',
      search: 'code',
      limit: 20,
      offset: 20,
    });
    expect(builders.recursos.where).toHaveBeenCalledTimes(2);
    expect(builders.recursos.limit).toHaveBeenCalledWith(20);
    expect(builders.recursos.offset).toHaveBeenCalledWith(20);
    expect(runtime.query).toHaveBeenCalledWith(query);
  });

  it('counts resources using the same category and search predicates', async () => {
    await expect(
      repository.countResources({ categoryId: 'cat-1', search: 'code' }),
    ).resolves.toBe(1);
    expect(builders.recursos.where).toHaveBeenCalledTimes(2);
    expect(runtime.query).toHaveBeenCalledWith(query);
  });

  it('counts copies by resource and state', async () => {
    await expect(
      repository.countCopiesByResourceAndState('resource-1', 'PRESTADO'),
    ).resolves.toBe(1);
    expect(builders.ejemplares.where).toHaveBeenCalledTimes(2);
    expect(runtime.query).toHaveBeenCalledWith(query);
  });
});
