import { ApiError, apiRequest } from '../../../shared/api/client'
import { authenticatedRequest, getSession } from '../../auth/api/auth-api'
import { guardedMutation, mutationConfirmation } from '../../../shared/api/mutation-guard'

export interface Category {
  id: string
  nombre: string
  resourceCount: number
  tiempoMaximoPrestamoDias: number
  tiempoMaximoPrestamoHoras: number
}
export interface Resource {
  id: string
  categoriaId: string
  nombre: string
  descripcion: string | null
  durationHours: number | null
  available: boolean
  availableCopies: number
  totalCopies: number
}
export interface ResourceDetail extends Resource {
  categoria: Omit<Category, 'resourceCount'> | null
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
}
export interface CopyDetail extends Copy {
  recurso: { id: string; nombre: string; categoriaId: string }
}
export interface ResourcePage {
  data: Resource[]
  total: number
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
export const getCategories = (signal?: AbortSignal) =>
  apiRequest<Category[]>('/inventory/categories', { signal })
// Endpoint completo, no una página del catálogo. DISPONIBLE excluye RESERVADO.
export async function getGlobalAvailability(signal?: AbortSignal): Promise<Resource[]> {
  const result = await apiRequest<Resource[]>('/inventory/availability', { signal })
  if (!Array.isArray(result) || result.some(r => !r?.id || !r.categoriaId || !Number.isInteger(r.availableCopies) || r.availableCopies < 0))
    throw new ApiError('Respuesta de disponibilidad global incompatible.', 0)
  return result
}
export function categoryAvailability(resources: Resource[] | null, categoryId: string): number | null {
  return resources === null ? null : resources.filter(r => r.categoriaId === categoryId).reduce((total, r) => total + r.availableCopies, 0)
}
export async function getResource(id: string, signal?: AbortSignal) {
  const owner = getSession()?.user.id
  const confirm = mutationConfirmation()
  const result = await apiRequest<ResourceDetail>('/inventory/resources/' + encodeURIComponent(id), { signal })
  if (result?.id === id && confirm(resourceIntent(result))) confirmedResources.set(owner + ':' + resourceIntent(result), result.id)
  return result
}
export async function getCopies(id: string, signal?: AbortSignal) {
  const confirm = mutationConfirmation()
  const result = await apiRequest<Copy[]>('/inventory/resources/' + encodeURIComponent(id) + '/copies', { signal })
  for (const copy of result) if (copy.id && copy.recursoId === id && copy.codigoInventario) confirm(copyIntent(id, copy.codigoInventario))
  return result
}
export const getCopy = (id: string, signal?: AbortSignal) =>
  apiRequest<CopyDetail>('/inventory/copies/' + encodeURIComponent(id), { signal })
export async function getResources(filters: CatalogFilters, signal?: AbortSignal): Promise<ResourcePage> {
  const owner = getSession()?.user.id
  const confirm = mutationConfirmation()
  const query = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) })
  if (filters.search) query.set('search', filters.search)
  if (filters.categoryId) query.set('categoryId', filters.categoryId)
  if (filters.available) query.set('available', filters.available)
  const result = await apiRequest<ResourcePage>('/inventory/resources?' + query, { signal })
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
export async function saveResource(id: string | null, body: ResourceInput) {
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
  const result = await authenticatedRequest<Resource>(
    '/inventory/resources' + (id ? '/' + encodeURIComponent(id) : ''),
    { method: id ? 'PATCH' : 'POST', body },
  )
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
  const result = await authenticatedRequest<Copy>(
    '/inventory/resources/' + encodeURIComponent(resourceId) + '/copies',
    { method: 'POST', body: { codigoInventario: codigoInventario.trim() } },
  )
  if (
    !result?.id ||
    result.recursoId !== resourceId ||
    result.codigoInventario !== codigoInventario.trim()
  )
    throw new ApiError('No se confirmó el ejemplar. Actualiza la lista antes de repetir.', 0)
  return result
  })
}
export async function changeCopyState(copy: Copy, estado: 'DISPONIBLE' | 'NO_DISPONIBLE') {
  if (copy.estado === 'PRESTADO' || copy.estado === 'RESERVADO')
    throw new ApiError('No se puede alterar una copia ocupada desde inventario.', 409)
  // Revalidar origen justo antes del envío; no soluciona la carrera del servidor.
  const current = await getCopy(copy.id)
  if (current.estado === 'PRESTADO' || current.estado === 'RESERVADO')
    throw new ApiError('El ejemplar está ocupado. Actualiza la lista.', 409)
  const result = await authenticatedRequest<Copy>(
    '/inventory/copies/' + encodeURIComponent(copy.id) + '/state',
    { method: 'PATCH', body: { estado } },
  )
  if (result?.id !== copy.id || result.estado !== estado)
    throw new ApiError('No se confirmó el cambio de estado.', 0)
  return result
}
