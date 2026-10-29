/** Plantilla de artículo, no inventario independiente por ejemplar. */
export interface ResourceAccessory {
  id: string;
  nombre: string;
}

export interface StoredResourceAccessory extends ResourceAccessory {
  recursoId: string;
  nombreNormalizado: string;
  activo: boolean;
}

export interface ResourceAccessoryInput {
  id?: string;
  nombre: string;
}

export interface ResourceLoanPolicy {
  resourceId: string;
  categoryId: string;
  durationHours: number | null;
  effectiveDurationHours: number;
  source: 'RESOURCE' | 'CATEGORY';
}

/** Persistir por valor al crear la operación, nunca reconstruir desde el catálogo. */
export interface CopyLoanSnapshot {
  schemaVersion: 1;
  copyId: string;
  resourceId: string;
  policy: ResourceLoanPolicy;
  accessories: ResourceAccessory[];
}

export const normalizeAccessoryName = (name: string): string =>
  name.normalize('NFKC').trim().toLowerCase();
