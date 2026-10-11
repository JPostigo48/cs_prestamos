export type InventoryCopyStatus = 'DISPONIBLE' | 'PRESTADO' | 'NO_DISPONIBLE';

export type InventoryCopyStateManaged = Extract<
  InventoryCopyStatus,
  'DISPONIBLE' | 'NO_DISPONIBLE'
>;

export type InventoryCategory = {
  id: string;
  nombre: string;
  tiempoMaximoPrestamoDias: number;
  resourceCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type InventoryResource = {
  id: string;
  categoriaId: string;
  nombre: string;
  descripcion?: string | null;
  available?: boolean;
  totalCopies?: number;
  availableCopies?: number;
  category?: InventoryCategory;
  createdAt?: Date;
  updatedAt?: Date;
};

export type InventoryCopy = {
  id: string;
  recursoId: string;
  codigoInventario: string;
  estado: InventoryCopyStatus;
  recurso?: InventoryResource;
  observaciones?: InventoryObservation[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type InventoryObservation = {
  id: string;
  ejemplarId: string;
  descripcion: string;
  fecha?: Date;
  createdAt?: Date;
};

export type ResourceAvailability = {
  resourceId: string;
  available: boolean;
  totalCopies: number;
  disponibles: number;
  prestados: number;
  noDisponibles: number;
};
