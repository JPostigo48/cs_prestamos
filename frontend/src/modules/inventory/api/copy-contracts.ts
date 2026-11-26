import { inventoryContractError, inventoryRecord, readInventoryCompatibility, type InventoryCompatibility } from './compatibility-contracts'
export const physicalConditions = ['APTO', 'DANADO', 'INCOMPLETO', 'DANADO_E_INCOMPLETO', 'PERDIDO', 'ROBADO'] as const
export interface CopyVerification { fitForLoan: true; componentsComplete: true; reason: string; evidenceIds: string[] }
export function validCopyVerification(v: unknown): v is CopyVerification {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  return x.fitForLoan === true && x.componentsComplete === true && typeof x.reason === 'string' && !!x.reason.trim() && x.reason.length <= 1000 &&
    Array.isArray(x.evidenceIds) && x.evidenceIds.every(id => typeof id === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) && new Set(x.evidenceIds.map(id => id.toLowerCase())).size === x.evidenceIds.length
}
export function validCopy(v: unknown): boolean {
  try { parseCopy(v); return true } catch { return false }
}
export function parseCopy(v: unknown) {
  const x = inventoryRecord(v), compatibility = readInventoryCompatibility(x)
  const condition = !Object.hasOwn(x, 'condicionFisica') && !compatibility ? null : x.condicionFisica
  const enabled = !Object.hasOwn(x, 'habilitado') && !compatibility ? null : x.habilitado
  if (typeof x.id !== 'string' || !x.id || typeof x.recursoId !== 'string' || !x.recursoId || typeof x.codigoInventario !== 'string' || !x.codigoInventario ||
    typeof x.estado !== 'string' || !['DISPONIBLE', 'NO_DISPONIBLE', 'PRESTADO', 'RESERVADO'].includes(x.estado) ||
    !(condition === null || physicalConditions.includes(condition as typeof physicalConditions[number])) || !(enabled === null || typeof enabled === 'boolean')) return inventoryContractError()
  if (compatibility && ((!compatibility.capabilities.physicalCondition && condition !== null) ||
    (compatibility.capabilities.administrativeEnablement ? enabled === null : enabled !== null))) return inventoryContractError()
  return { ...x, id: x.id, recursoId: x.recursoId, codigoInventario: x.codigoInventario,
    estado: x.estado as 'DISPONIBLE' | 'NO_DISPONIBLE' | 'PRESTADO' | 'RESERVADO',
    condicionFisica: condition as typeof physicalConditions[number] | null, habilitado: enabled as boolean | null, compatibility }
}
// Prerrequisito del ejemplar; no sustituye actividad de recurso/categoría, permisos, políticas ni compromisos.
export function isCopyEligibleForLoan(copy: {
  estado: string; condicionFisica: typeof physicalConditions[number] | null; habilitado: boolean | null; compatibility: InventoryCompatibility | null
}): boolean {
  return copy.compatibility?.capabilities.verifiedAvailability === true && copy.estado === 'DISPONIBLE' && copy.condicionFisica === 'APTO' && copy.habilitado === true
}
