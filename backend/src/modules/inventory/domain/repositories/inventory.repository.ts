import type {
  InventoryCopyStateManaged,
  InventoryCopyStatus,
} from '../entities/inventory.types.js';

export abstract class InventoryRepository {
  abstract createCategory(data: {
    nombre: string;
    tiempoMaximoPrestamoDias: number;
  }): Promise<any>;

  abstract findAllCategories(): Promise<any[]>;
  abstract findCategoryById(categoryId: string): Promise<any>;
  abstract updateCategory(
    categoryId: string,
    data: Partial<{ nombre: string; tiempoMaximoPrestamoDias: number }>,
  ): Promise<any>;
  abstract deleteCategory(categoryId: string): Promise<unknown>;
  abstract countResourcesByCategory(categoryId: string): Promise<number>;

  abstract createResource(data: {
    categoriaId: string;
    nombre: string;
    descripcion?: string | null;
  }): Promise<any>;

  abstract findAllResources(filters?: {
    categoryId?: string;
    available?: boolean;
    search?: string;
  }): Promise<any[]>;
  abstract findResourceById(resourceId: string): Promise<any>;
  abstract updateResource(
    resourceId: string,
    data: Partial<{
      categoriaId: string;
      nombre: string;
      descripcion?: string | null;
    }>,
  ): Promise<any>;
  abstract deleteResource(resourceId: string): Promise<unknown>;
  abstract countCopiesByResource(resourceId: string): Promise<number>;
  abstract countAvailableCopiesByResource(resourceId: string): Promise<number>;

  abstract createCopy(data: {
    recursoId: string;
    codigoInventario: string;
    estado?: InventoryCopyStatus;
  }): Promise<any>;
  abstract findCopiesByResource(resourceId: string): Promise<any[]>;
  abstract findCopyById(copyId: string): Promise<any>;
  abstract updateCopyState(
    copyId: string,
    estado: InventoryCopyStateManaged,
  ): Promise<any>;

  abstract createObservation(data: {
    ejemplarId: string;
    descripcion: string;
  }): Promise<any>;
  abstract findObservationsByCopy(copyId: string): Promise<any[]>;
}
