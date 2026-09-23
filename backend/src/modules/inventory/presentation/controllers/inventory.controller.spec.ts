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
});
