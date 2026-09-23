import type { InventoryCopyStatus } from '../../domain/entities/inventory.types.js';

export type CreateCategoryInput = {
  nombre: string;
  tiempoMaximoPrestamoDias: number;
};

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export type CreateResourceInput = {
  categoriaId: string;
  nombre: string;
  descripcion?: string | null;
};

export type UpdateResourceInput = Partial<CreateResourceInput>;

export type CreateCopyInput = {
  codigoInventario: string;
};

export type UpdateCopyStateInput = {
  estado: InventoryCopyStatus;
};

export type CreateCopyObservationInput = {
  descripcion: string;
};
