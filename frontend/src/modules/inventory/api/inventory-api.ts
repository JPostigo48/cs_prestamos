import { ApiError, apiRequest } from '../../../shared/api/client'
import { authenticatedRequest, getSession } from '../../auth/api/auth-api'
import { guardedMutation, mutationConfirmation } from '../../../shared/api/mutation-guard'
import { parseCopy, validCopyVerification, type CopyVerification, type physicalConditions } from './copy-contracts'
import { inventoryActionAllowed, inventoryContractError, inventoryCount, inventoryRecord, readInventoryAvailability, readInventoryCompatibility, type InventoryCompatibility, type RegisteredStock } from './compatibility-contracts'
export { inventoryActionAllowed, inventoryCompatibilityMessage } from './compatibility-contracts'
export type { InventoryCompatibility, RegisteredStock } from './compatibility-contracts'
import { isStaff } from '../../auth/access-policy'
import { getResourceHistory, getLoanEvidence } from '../../loans/api/loans-api'
import type { LoanEvidence } from '../../loans/api/closure-contracts'

export interface Category {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  copyCount: number
  resourceCount: number
  tiempoMaximoPrestamoDias: number
  tiempoMaximoPrestamoHoras: number
}
export interface Resource {
  id: string
  categoriaId: string
  nombre: string
  descripcion: string | null
  activo: boolean
  durationHours: number | null
  available: boolean | null
  availableCopies: number | null
  totalCopies: number | null
  compatibility: InventoryCompatibility | null
  registeredStock: RegisteredStock | null
}
export interface ResourceDetail extends Resource {
  categoria: Pick<Category, 'id' | 'nombre' | 'tiempoMaximoPrestamoDias' | 'tiempoMaximoPrestamoHoras'> | null
  loanPolicy: ResourceLoanPolicy
}
export interface ResourceLoanPolicy {
  resourceId: string
  categoryId: string
  durationHours: number | null
  effectiveDurationHours: number
  source: 'RESOURCE' | 'CATEGORY'
}
export interface Copy {
  id: string
  recursoId: string
  codigoInventario: string
  estado: 'DISPONIBLE' | 'PRESTADO' | 'NO_DISPONIBLE' | 'RESERVADO'
  condicionFisica: typeof physicalConditions[number] | null
  habilitado: boolean | null
  compatibility: InventoryCompatibility | null
}
export interface CopyDetail extends Copy {
  recurso: { id: string; nombre: string; categoriaId: string }
}
export interface ResourcePage {
  compatibility: InventoryCompatibility | null
  data: Resource[]
  total: number | null
  page: number
  limit: number
}
export interface CatalogFilters {
  search: string
  categoryId: string
  available: string
  page: number
  limit: number
}
export interface GlobalAvailability extends Resource {
  disponibles: number | null
  prestados: number | null
  noDisponibles: number | null
  reservados: number | null
}
export const getCategories = (signal?: AbortSignal, active?: boolean) =>
  apiRequest<Category[]>('/inventory/categories' + (active === undefined ? '' : '?active=' + active), { signal })
// Endpoint completo, no una página del catálogo. DISPONIBLE excluye RESERVADO.
export async function getGlobalAvailability(signal?: AbortSignal): Promise<GlobalAvailability[]> {
  const result = await apiRequest<unknown>('/inventory/availability', { signal })
  if (!Array.isArray(result)) return inventoryContractError()
  return result.map(value => {
    const row = inventoryRecord(value)
    const resource = parseResource(value)
    if (resource.compatibility) {
      const counts = parseResourceAvailability({ ...row, resourceId: resource.id })
      if (counts.disponibles !== resource.availableCopies) return inventoryContractError()
    }
    const count = (key: string): number | null => {
      if (!Object.hasOwn(row, key) && !resource.compatibility) return null
      if (row[key] !== null && !inventoryCount(row[key])) return inventoryContractError()
      return row[key] as number | null
    }
    return { ...resource, disponibles: count('disponibles'), prestados: count('prestados'), noDisponibles: count('noDisponibles'), reservados: count('reservados') }
  })
}
export function categoryAvailability(resources: Resource[] | null, categoryId: string): number | null {
  if (resources === null) return null
  const rows = resources.filter(r => r.categoriaId === categoryId)
  if (rows.some(r => r.availableCopies === null)) return null
  return rows.reduce((total, r) => total + r.availableCopies!, 0)
}
export function parseResource(value: unknown): Resource {
  const row = inventoryRecord(value), availability = readInventoryAvailability(row)
  if (typeof row.id !== 'string' || !row.id || typeof row.categoriaId !== 'string' || !row.categoriaId) return inventoryContractError()
  if (availability.compatibility && (typeof row.nombre !== 'string' || typeof row.activo !== 'boolean' ||
    !(row.descripcion === null || typeof row.descripcion === 'string') ||
    !(row.durationHours === null || (inventoryCount(row.durationHours) && row.durationHours > 0)))) return inventoryContractError()
  return { ...row, ...availability } as Resource
}
export interface ResourceAvailability {
  resourceId: string
  available: boolean | null
  totalCopies: number | null
  disponibles: number | null
  noDisponibles: number | null
  prestados: number
  reservados: number | null
  compatibility: InventoryCompatibility | null
  registeredStock: RegisteredStock | null
}
export function parseResourceAvailability(value: unknown): ResourceAvailability {
  const row = inventoryRecord(value)
  const availability = readInventoryAvailability({ ...row, availableCopies: row.disponibles })
  if (typeof row.resourceId !== 'string' || !row.resourceId || !inventoryCount(row.prestados) ||
    !(row.noDisponibles === null || inventoryCount(row.noDisponibles)) ||
    (availability.compatibility || Object.hasOwn(row, 'reservados') ? !inventoryCount(row.reservados) : false) ||
    (availability.compatibility && (availability.compatibility.capabilities.verifiedAvailability ? row.noDisponibles === null : row.noDisponibles !== null))) return inventoryContractError()
  if (availability.registeredStock && (row.prestados !== availability.registeredStock.prestados || row.reservados !== availability.registeredStock.reservados)) return inventoryContractError()
  if (availability.compatibility?.capabilities.verifiedAvailability &&
    Number(row.disponibles) + Number(row.prestados) + Number(row.noDisponibles) + Number(row.reservados) !== availability.totalCopies) return inventoryContractError()
  return { ...row, ...availability, resourceId: row.resourceId, disponibles: availability.availableCopies,
    noDisponibles: row.noDisponibles as number | null, prestados: row.prestados, reservados: (row.reservados ?? null) as number | null }
}
export async function getResourceAvailability(id: string, signal?: AbortSignal): Promise<ResourceAvailability> {
  const result = parseResourceAvailability(await apiRequest<unknown>('/inventory/resources/' + encodeURIComponent(id) + '/availability', { signal }))
  if (result.resourceId !== id) return inventoryContractError()
  return result
}
// Una página mínima permite conocer capacidades sin depender de que existan recursos.
export async function getInventoryCompatibility(signal?: AbortSignal): Promise<InventoryCompatibility | null> {
  return (await getResources({ search: '', categoryId: '', available: '', page: 1, limit: 1 }, signal)).compatibility
}
export async function getResource(id: string, signal?: AbortSignal) {
  const owner = getSession()?.user.id
  const confirm = mutationConfirmation()
  const raw = await apiRequest<ResourceDetail>('/inventory/resources/' + encodeURIComponent(id), { signal })
  const result = { ...raw, ...parseResource(raw) }
  if (result.id !== id) return inventoryContractError()
  if (result?.id === id && confirm(resourceIntent(result))) confirmedResources.set(owner + ':' + resourceIntent(result), result.id)
  return result
}
export async function getCopies(id: string, signal?: AbortSignal) {
  const confirm = mutationConfirmation()
  const raw = await apiRequest<unknown>('/inventory/resources/' + encodeURIComponent(id) + '/copies', { signal })
  if (!Array.isArray(raw)) return inventoryContractError()
  const result = raw.map(parseCopy)
  if (result.some(copy => copy.recursoId !== id)) throw new ApiError('Respuesta de ejemplares incompatible.', 0)
  for (const copy of result) if (copy.id && copy.recursoId === id && copy.codigoInventario) confirm(copyIntent(id, copy.codigoInventario))
  return result
}
export async function getCopy(id: string, signal?: AbortSignal) {
  const raw = await apiRequest<CopyDetail>('/inventory/copies/' + encodeURIComponent(id), { signal })
  const result = { ...raw, ...parseCopy(raw) }
  if (result.id !== id) throw new ApiError('Respuesta de ejemplar incompatible.', 0)
  return result
}
export async function getResources(filters: CatalogFilters, signal?: AbortSignal): Promise<ResourcePage> {
  const owner = getSession()?.user.id
  const confirm = mutationConfirmation()
  const query = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) })
  if (filters.search) query.set('search', filters.search)
  if (filters.categoryId) query.set('categoryId', filters.categoryId)
  if (filters.available) query.set('available', filters.available)
  const result = await apiRequest<ResourcePage>('/inventory/resources?' + query, { signal })
  const compatibility = readInventoryCompatibility(inventoryRecord(result))
  if (!compatibility) {
    if (!Object.hasOwn(result, 'total')) result.total = null
    if (!Object.hasOwn(result, 'page')) result.page = filters.page
    if (!Object.hasOwn(result, 'limit')) result.limit = filters.limit
  }
  if (!Array.isArray(result.data) || (!(result.total === null && !compatibility) && !inventoryCount(result.total)) || !inventoryCount(result.page) || result.page < 1 || !inventoryCount(result.limit) || result.limit < 1) return inventoryContractError()
  result.data = result.data.map(parseResource)
  result.compatibility = compatibility
  if (compatibility && result.data.some(row => !row.compatibility || row.compatibility.status !== compatibility.status)) return inventoryContractError()
  for (const resource of result.data) if (resource.id && confirm(resourceIntent(resource))) confirmedResources.set(owner + ':' + resourceIntent(resource), resource.id)
  return result
}
export function durationLabel(
  category: Pick<Category, 'tiempoMaximoPrestamoHoras' | 'tiempoMaximoPrestamoDias'>,
): string {
  return category.tiempoMaximoPrestamoHoras % 24 === 0
    ? `${category.tiempoMaximoPrestamoHoras / 24} días`
    : `${category.tiempoMaximoPrestamoHoras} horas`
}
export interface Accessory {
  id: string
  nombre: string
}
export const getAccessories = (resourceId: string, signal?: AbortSignal) =>
  authenticatedRequest<{ items: Accessory[] }>('/inventory/resources/' + encodeURIComponent(resourceId) + '/accessories', { signal }).then(result => {
    if (!validAccessories(result)) throw new ApiError('Respuesta de accesorios incompatible.', 0)
    return result
  })
export type AccessoryInput = { id?: string; nombre: string }
const validAccessories = (result: { items: Accessory[] }) => Array.isArray(result?.items) &&
  result.items.every(item => typeof item?.id === 'string' && !!item.id && typeof item.nombre === 'string' && !!item.nombre.trim()) &&
  new Set(result.items.map(item => item.id)).size === result.items.length
export async function saveAccessories(resourceId: string, input: (string | AccessoryInput)[]) {
  const items = input.map(item => typeof item === 'string' ? { nombre: item.trim() } : { ...item, nombre: item.nombre.trim() })
  const result = await authenticatedRequest<{ items: Accessory[] }>('/inventory/resources/' + encodeURIComponent(resourceId) + '/accessories', {
    method: 'PUT', body: { items },
  })
  if (
    !validAccessories(result) || result.items.length !== items.length ||
    items.some(expected => !result.items.some(item => item.nombre === expected.nombre && (!expected.id || item.id === expected.id)))
  )
    throw new ApiError('El servidor no confirmó la lista completa de accesorios.', 0)
  return result
}
export async function saveLoanPolicy(resourceId: string, durationHours: number | null) {
  const result = await authenticatedRequest<ResourceLoanPolicy>('/inventory/resources/' + encodeURIComponent(resourceId) + '/loan-policy', {
    method: 'PATCH', body: { durationHours },
  })
  if (result?.resourceId !== resourceId || result.durationHours !== durationHours || !Number.isInteger(result.effectiveDurationHours) || result.effectiveDurationHours < 1 ||
    (durationHours === null ? result.source !== 'CATEGORY' : result.source !== 'RESOURCE' || result.effectiveDurationHours !== durationHours))
    throw new ApiError('El servidor no confirmó la excepción solicitada.', 0)
  return result
}
export interface ResourceInput {
  nombre: string
  categoriaId: string
  descripcion?: string | null
}
// Solo datos de inventario normalizados, nunca sesión, credenciales ni cuerpos genéricos.
export const resourceIntent = (body: ResourceInput) => 'resource-create:' + JSON.stringify([body.categoriaId, body.nombre.trim(), body.descripcion?.trim() || null])
export const copyIntent = (resourceId: string, code: string) => 'copy-create:' + JSON.stringify([resourceId, code.trim()])
// Resultado recuperable de una intención, no caché de objetos del catálogo.
const confirmedResources = new Map<string, string>()
export async function saveResource(id: string | null, body: ResourceInput, options: { descriptiveOnly?: boolean } = {}) {
  if (options.descriptiveOnly && !id) throw new ApiError('La edición descriptiva requiere un recurso existente.', 400)
  const owner = getSession()?.user.id
  const recoveryKey = owner + ':' + resourceIntent(body)
  const confirmed = confirmedResources.get(recoveryKey)
  if (!id && confirmed) {
    // Una lectura fallida conserva la recuperación y nunca dispara un POST alternativo.
    const current = await getResource(confirmed)
    if (getSession()?.user.id !== owner || current?.id !== confirmed || resourceIntent(current) !== resourceIntent(body))
      throw new ApiError('El recurso recuperado cambió. Actualiza el catálogo antes de continuar.', 409)
    confirmedResources.delete(recoveryKey)
    return current
  }
  return guardedMutation(id ? 'resource-update:' + id : resourceIntent(body), async () => {
  const result = parseResource(await authenticatedRequest<Resource>(
    '/inventory/resources' + (id ? '/' + encodeURIComponent(id) : ''),
    { method: id ? 'PATCH' : 'POST', body: options.descriptiveOnly ? { nombre: body.nombre, descripcion: body.descripcion } : body },
  ))
  if (!result?.id || (id && result.id !== id) || typeof result.nombre !== 'string' || typeof result.categoriaId !== 'string' || resourceIntent(result) !== resourceIntent(body))
    throw new ApiError(
      'El servidor no confirmó el recurso. Verifica el catálogo antes de repetir.',
      0,
    )
  if (id) for (const [key, recoveredId] of confirmedResources)
    if (recoveredId === id && key.startsWith(owner + ':')) confirmedResources.delete(key)
  return result
  })
}
export async function createCopy(resourceId: string, codigoInventario: string) {
  return guardedMutation(copyIntent(resourceId, codigoInventario), async () => {
  const result = parseCopy(await authenticatedRequest<Copy>(
    '/inventory/resources/' + encodeURIComponent(resourceId) + '/copies',
    { method: 'POST', body: { codigoInventario: codigoInventario.trim() } },
  ))
  if (
    !result?.id ||
    result.recursoId !== resourceId ||
    result.codigoInventario !== codigoInventario.trim()
  )
    throw new ApiError('No se confirmó el ejemplar. Actualiza la lista antes de repetir.', 0)
  return result
  })
}
export async function changeCopyState(copy: Copy, estado: 'DISPONIBLE' | 'NO_DISPONIBLE', verification?: CopyVerification) {
  if (!isStaff(getSession()?.user.role ?? 'USUARIO')) throw new ApiError('Operación restringida al personal.', 403)
  if (copy.estado === 'PRESTADO' || copy.estado === 'RESERVADO')
    throw new ApiError('No se puede alterar una copia ocupada desde inventario.', 409)
  // Revalidar origen justo antes del envío; no soluciona la carrera del servidor.
  const current = await getCopy(copy.id)
  if (current.estado === 'PRESTADO' || current.estado === 'RESERVADO')
    throw new ApiError('El ejemplar está ocupado. Actualiza la lista.', 409)
  if (estado === 'DISPONIBLE' && (!current.habilitado || !validCopyVerification(verification))) throw new ApiError('Se requiere habilitación administrativa y verificación explícita de aptitud, componentes, motivo y evidencias.', 400)
  if (!inventoryActionAllowed(current.compatibility, estado === 'DISPONIBLE' ? 'release' : 'manageCopy') ||
    (estado === 'DISPONIBLE' && current.estado === 'NO_DISPONIBLE' && !inventoryActionAllowed(current.compatibility, 'rehabilitate')))
    throw new ApiError('La compatibilidad de inventario no permite esta operación física. Actualiza el inventario.', 503)
  if (verification?.evidenceIds.length) {
    const available = await getCopyEvidence(current)
    if (verification.evidenceIds.some(id => !available.some(e => e.id === id))) throw new ApiError('Las evidencias no pertenecen a este ejemplar.', 400)
  }
  const result = parseCopy(await authenticatedRequest<Copy>(
    '/inventory/copies/' + encodeURIComponent(copy.id) + '/state',
    { method: 'PATCH', body: { estado, ...(verification ? { verification } : {}) } },
  ))
  if (result.id !== copy.id || result.estado !== estado || (estado === 'DISPONIBLE' && (result.condicionFisica !== 'APTO' || !result.habilitado)))
    throw new ApiError('No se confirmó el cambio de estado.', 0)
  return result
}
export async function getCopyEvidence(copy: Copy, signal?: AbortSignal): Promise<LoanEvidence[]> {
  const evidence: LoanEvidence[] = [], seen = new Set<string>()
  let expected: number | undefined
  let count = 0
  for (let page = 1; ; page++) {
    const history = await getResourceHistory(copy.recursoId, { page: String(page), limit: '100' }, signal)
    if (expected !== undefined && history.total !== expected) throw new ApiError('El historial cambió: vuelve a consultar evidencias.', 409)
    expected = history.total
    for (const loan of history.items) {
      if (seen.has(loan.id)) throw new ApiError('Historial duplicado: no se pudieron verificar evidencias.', 0)
      seen.add(loan.id); count++
      if (loan.copyId === copy.id) evidence.push(...await getLoanEvidence(loan.id, signal))
    }
    if (count === expected) return evidence
    if (!history.items.length || count > expected) throw new ApiError('Historial incompleto: no se pudieron verificar evidencias.', 0)
  }
}
