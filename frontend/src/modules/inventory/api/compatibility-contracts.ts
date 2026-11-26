import { ApiError } from '../../../shared/api/client'

export interface InventoryCompatibility {
  status: 'READY' | 'UPDATE_PENDING'
  message: string | null
  capabilities: { physicalCondition: boolean; administrativeEnablement: boolean; verifiedAvailability: boolean }
  actions: { descriptiveEdits: true; create: boolean; activate: boolean; release: boolean; rehabilitate: boolean; manageCopy: boolean }
}
export interface RegisteredStock { libres: number; prestados: number; retenidos: number; reservados: number }
export type InventoryAction = keyof InventoryCompatibility['actions']
export const inventoryPendingMessage = 'Actualización de inventario pendiente. La disponibilidad no se puede verificar y las operaciones de circulación están deshabilitadas.'
export const inventoryUnknownMessage = 'Compatibilidad de inventario desconocida. La disponibilidad y las operaciones físicas requieren una actualización de los datos.'
export const inventoryActionAllowed = (compatibility: InventoryCompatibility | null | undefined, action: InventoryAction): boolean => compatibility?.actions[action] === true
export const inventoryCompatibilityMessage = (compatibility: InventoryCompatibility | null | undefined): string =>
  compatibility?.status === 'READY' ? '' : compatibility?.message || (compatibility ? inventoryPendingMessage : inventoryUnknownMessage)
export const inventoryContractError = (): never => { throw new ApiError('Respuesta de inventario incompatible.', 0) }
export function inventoryRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return inventoryContractError()
  return value as Record<string, unknown>
}
export const inventoryCount = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

// Solo la ausencia completa permite lectura legacy. null, undefined explícito o un objeto parcial no son fallback.
export function readInventoryCompatibility(row: Record<string, unknown>): InventoryCompatibility | null {
  if (!Object.hasOwn(row, 'compatibility')) return null
  const x = inventoryRecord(row.compatibility), c = inventoryRecord(x.capabilities), a = inventoryRecord(x.actions)
  if (typeof x.status !== 'string' || !['READY', 'UPDATE_PENDING'].includes(x.status) || !(x.message === null || typeof x.message === 'string') ||
    !['physicalCondition', 'administrativeEnablement', 'verifiedAvailability'].every(key => typeof c[key] === 'boolean') ||
    a.descriptiveEdits !== true || !['create', 'activate', 'release', 'rehabilitate', 'manageCopy'].every(key => typeof a[key] === 'boolean')) return inventoryContractError()
  const ready = x.status === 'READY'
  if (c.verifiedAvailability !== ready || (ready && (!c.physicalCondition || !c.administrativeEnablement || x.message !== null)) ||
    (!ready && (typeof x.message !== 'string' || !x.message.trim())) ||
    !['create', 'activate', 'release', 'rehabilitate', 'manageCopy'].every(key => a[key] === ready)) return inventoryContractError()
  return x as unknown as InventoryCompatibility
}

export function readInventoryAvailability(row: Record<string, unknown>) {
  const compatibility = readInventoryCompatibility(row)
  let registeredStock: RegisteredStock | null = null
  if (Object.hasOwn(row, 'registeredStock')) {
    const stock = inventoryRecord(row.registeredStock)
    if (!['libres', 'prestados', 'retenidos', 'reservados'].every(key => inventoryCount(stock[key]))) return inventoryContractError()
    registeredStock = stock as unknown as RegisteredStock
  } else if (compatibility) return inventoryContractError()
  const nullableCount = (key: string): number | null => {
    if (!Object.hasOwn(row, key) && !compatibility) return null
    if (row[key] !== null && !inventoryCount(row[key])) return inventoryContractError()
    return row[key] as number | null
  }
  const totalCopies = nullableCount('totalCopies'), availableCopies = nullableCount('availableCopies')
  const available = !Object.hasOwn(row, 'available') && !compatibility ? null : row.available
  if (available !== null && typeof available !== 'boolean') return inventoryContractError()
  if (compatibility && (!inventoryCount(totalCopies) ||
    (compatibility.capabilities.verifiedAvailability ? available === null || availableCopies === null : available !== null || availableCopies !== null))) return inventoryContractError()
  if (registeredStock && totalCopies !== Object.values(registeredStock).reduce((sum, count) => sum + count, 0)) return inventoryContractError()
  if (availableCopies !== null && totalCopies !== null && availableCopies > totalCopies) return inventoryContractError()
  if (registeredStock && availableCopies !== null && availableCopies > registeredStock.libres) return inventoryContractError()
  if (compatibility && available === true && (availableCopies === null || availableCopies === 0)) return inventoryContractError()
  return { compatibility, registeredStock, totalCopies, availableCopies, available: available as boolean | null }
}
