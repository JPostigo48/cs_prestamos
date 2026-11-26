import type { InventoryCompatibility } from './inventory-compatibility.js';

export type InventoryCopyStatus =
  'DISPONIBLE' | 'RESERVADO' | 'PRESTADO' | 'NO_DISPONIBLE';

export type InventoryCopyStateManaged = Extract<
  InventoryCopyStatus,
  'DISPONIBLE' | 'NO_DISPONIBLE'
>;

export const physicalConditions = [
  'APTO',
  'DANADO',
  'INCOMPLETO',
  'DANADO_E_INCOMPLETO',
  'PERDIDO',
  'ROBADO',
] as const;
export type PhysicalCondition = (typeof physicalConditions)[number];

export type CopyVerification = {
  fitForLoan: true;
  componentsComplete: true;
  reason: string;
  evidenceIds: string[];
};

export type ManagedCopyUpdate = {
  codigoInventario?: string;
  estado?: InventoryCopyStateManaged;
  habilitado?: boolean;
  verification?: CopyVerification;
};

export function validCopyVerification(
  value: unknown,
): value is CopyVerification {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<CopyVerification>;
  return (
    v.fitForLoan === true &&
    v.componentsComplete === true &&
    typeof v.reason === 'string' &&
    v.reason.trim().length > 0 &&
    v.reason.length <= 1000 &&
    Array.isArray(v.evidenceIds) &&
    v.evidenceIds.every(
      (id) =>
        typeof id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        ),
    ) &&
    new Set(v.evidenceIds.map((id) => id.toLowerCase())).size ===
      v.evidenceIds.length
  );
}

export type InventoryCategory = {
  id: string;
  nombre: string;
  tiempoMaximoPrestamoDias: number;
  tiempoMaximoPrestamoHoras?: number;
  resourceCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type InventoryResource = {
  id: string;
  categoriaId: string;
  nombre: string;
  descripcion?: string | null;
  available?: boolean | null;
  totalCopies?: number;
  availableCopies?: number | null;
  category?: InventoryCategory;
  createdAt?: Date;
  updatedAt?: Date;
};

export type InventoryCopy = {
  id: string;
  recursoId: string;
  codigoInventario: string;
  estado: InventoryCopyStatus;
  condicionFisica: PhysicalCondition | null;
  habilitado: boolean | null;
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
  available: boolean | null;
  totalCopies: number;
  disponibles: number | null;
  prestados: number;
  noDisponibles: number | null;
  reservados: number;
  registeredStock: {
    libres: number;
    prestados: number;
    retenidos: number;
    reservados: number;
  };
  compatibility: InventoryCompatibility;
};
