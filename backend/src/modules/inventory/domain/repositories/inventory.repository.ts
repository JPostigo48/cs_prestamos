import type {
  InventoryCopyStateManaged,
  InventoryCopyStatus,
} from '../entities/inventory.types.js';
import type { AuditActor } from '../../../../shared/application/audit-actor.js';
import type {
  ResourceAccessoryInput,
  StoredResourceAccessory,
} from '../entities/resource-configuration.js';

export abstract class InventoryRepository {
  abstract findResourceAccessories(
    resourceId: string,
  ): Promise<StoredResourceAccessory[]>;
  abstract replaceResourceAccessories(
    resourceId: string,
    items: ResourceAccessoryInput[],
  ): Promise<StoredResourceAccessory[]>;
  abstract updateResourceLoanPolicy(
    resourceId: string,
    durationHours: number | null,
  ): Promise<void>;
  abstract audited<T>(
    actor: AuditActor,
    action: string,
    work: (repository: InventoryRepository) => Promise<T>,
  ): Promise<T>;
  abstract updateManagedCopy(
    copyId: string,
    data: { codigoInventario?: string; estado?: InventoryCopyStateManaged },
  ): Promise<any>;
  abstract createCategory(data: {
    nombre: string;
    tiempoMaximoPrestamoDias: number;
    tiempoMaximoPrestamoHoras?: number;
  }): Promise<any>;

  abstract findAllCategories(): Promise<any[]>;
  abstract findCategoryById(categoryId: string): Promise<any>;
  abstract updateCategory(
    categoryId: string,
    data: Partial<{
      nombre: string;
      tiempoMaximoPrestamoDias: number;
      tiempoMaximoPrestamoHoras: number;
    }>,
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
    limit?: number;
    offset?: number;
  }): Promise<any[]>;
  abstract countResources(filters?: {
    categoryId?: string;
    search?: string;
  }): Promise<number>;
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
  abstract countCopiesByResourceAndState(
    resourceId: string,
    estado: InventoryCopyStatus,
  ): Promise<number>;

  abstract createCopy(data: {
    recursoId: string;
    codigoInventario: string;
    estado?: InventoryCopyStatus;
  }): Promise<any>;
  abstract findCopiesByResource(resourceId: string): Promise<any[]>;
  abstract findCopyById(copyId: string): Promise<any>;
  abstract deleteCopy(copyId: string): Promise<number>;
  abstract updateCopyState(
    copyId: string,
    estado: InventoryCopyStateManaged,
  ): Promise<any>;
  abstract markCopyAsLoaned(copyId: string): Promise<any>;

  abstract createObservation(data: {
    ejemplarId: string;
    descripcion: string;
  }): Promise<any>;
  abstract findObservationsByCopy(copyId: string): Promise<any[]>;
}
