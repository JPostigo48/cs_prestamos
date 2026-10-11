import { describe, it, expect, vi } from 'vitest';
import { InventoryController } from './inventory.controller.js';

describe('InventoryController', () => {
  it('should delegate category creation to the service', async () => {
    const service = {
      createCategory: vi
        .fn()
        .mockResolvedValue({ id: 'cat-1', nombre: 'Libros' }),
    };

    const controller = new InventoryController(service as any);
    const result = await controller.createCategory({
      nombre: 'Libros',
      tiempoMaximoPrestamoDias: 14,
    });

    expect(service.createCategory).toHaveBeenCalledWith({
      nombre: 'Libros',
      tiempoMaximoPrestamoDias: 14,
    });
    expect(result.nombre).toBe('Libros');
  });

  it('should delegate list resources', async () => {
    const service = {
      listResources: vi.fn().mockResolvedValue([]),
    };

    const controller = new InventoryController(service as any);
    const result = await controller.listResources();

    expect(service.listResources).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it.each([
    ['listCategories', (controller: InventoryController) => controller.listCategories(), 'listCategories', []],
    ['getCategory', (controller: InventoryController) => controller.getCategory('cat-1'), 'getCategory', ['cat-1']],
    ['updateCategory', (controller: InventoryController) => controller.updateCategory('cat-1', { nombre: 'Nuevo' }), 'updateCategory', ['cat-1', { nombre: 'Nuevo' }]],
    ['deleteCategory', (controller: InventoryController) => controller.deleteCategory('cat-1'), 'deleteCategory', ['cat-1']],
    ['createResource', (controller: InventoryController) => controller.createResource({ categoriaId: 'cat-1', nombre: 'Libro' }), 'createResource', [{ categoriaId: 'cat-1', nombre: 'Libro' }]],
    ['getResource', (controller: InventoryController) => controller.getResource('resource-1'), 'getResource', ['resource-1']],
    ['updateResource', (controller: InventoryController) => controller.updateResource('resource-1', { nombre: 'Nuevo' }), 'updateResource', ['resource-1', { nombre: 'Nuevo' }]],
    ['deleteResource', (controller: InventoryController) => controller.deleteResource('resource-1'), 'deleteResource', ['resource-1']],
    ['createCopy', (controller: InventoryController) => controller.createCopy('resource-1', { codigoInventario: 'LIB-1' }), 'createCopy', ['resource-1', { codigoInventario: 'LIB-1' }]],
    ['listCopiesByResource', (controller: InventoryController) => controller.listCopiesByResource('resource-1'), 'listCopiesByResource', ['resource-1']],
    ['getCopy', (controller: InventoryController) => controller.getCopy('copy-1'), 'getCopy', ['copy-1']],
    ['deleteCopy', (controller: InventoryController) => controller.deleteCopy('copy-1'), 'deleteCopy', ['copy-1']],
    ['updateCopyState', (controller: InventoryController) => controller.updateCopyState('copy-1', { estado: 'DISPONIBLE' }), 'updateCopyState', ['copy-1', { estado: 'DISPONIBLE' }]],
    ['getResourceAvailability', (controller: InventoryController) => controller.getResourceAvailability('resource-1'), 'getResourceAvailability', ['resource-1']],
    ['getGlobalAvailability', (controller: InventoryController) => controller.getGlobalAvailability(), 'getGlobalAvailability', []],
    ['createObservation', (controller: InventoryController) => controller.createObservation('copy-1', { descripcion: 'Nota' }), 'createObservation', ['copy-1', { descripcion: 'Nota' }]],
    ['listObservationsByCopy', (controller: InventoryController) => controller.listObservationsByCopy('copy-1'), 'listObservationsByCopy', ['copy-1']],
  ])('delegates %s with its expected parameters', async (_name, invoke, method, args) => {
    const service = {
      [method as string]: vi.fn().mockResolvedValue([]),
    };
    const controller = new InventoryController(service as any);
    await invoke(controller);
    expect(service[method as string]).toHaveBeenCalledWith(...(args as any[]));
  });

  it('delegates resource listing with the query DTO', async () => {
    const service = { listResources: vi.fn().mockResolvedValue([]) };
    const controller = new InventoryController(service as any);
    const query = {
      categoryId: 'cat-1',
      available: 'true',
      search: 'code',
      page: 2,
      limit: 10,
    };
    await controller.listResources(query);
    expect(service.listResources).toHaveBeenCalledWith(query);
  });
});
