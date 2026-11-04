import { ApiError } from '../../../shared/api/client'
import { guardedMutation } from '../../../shared/api/mutation-guard'
import { authenticatedRequest, getSession } from '../../auth/api/auth-api'
import type { PublicPolicy } from '../../project-showcase/services/termsApi'
import type { Category } from './inventory-api'

export interface CategoryInput {
  nombre: string
  descripcion: string | null
  activo: boolean
  tiempoMaximoPrestamoDias: number
  tiempoMaximoPrestamoHoras: number
}
export interface CategoryPolicies {
  status: 'COMPLETE' | 'INCOMPLETE' | 'UNAVAILABLE'
  eligibleForNewOperations: boolean
  termsVersionId: string | null
  policies: PublicPolicy[]
  rulesEditable: false
  message: string
}
export interface DeletionPreview {
  categoryId: string
  nombre: string
  resourceIds: string[]
  copyIds: string[]
  accessoryIds: string[]
  resourceCount: number
  copyCount: number
  blockers: { dependency: string; count: number; reason: string }[]
  canDelete: boolean
  wouldDelete: { categories: number; resources: number; copies: number; accessories: number }
  alternative: 'DEACTIVATE'
}
const path = (id: string) => '/inventory/categories/' + encodeURIComponent(id)
function requireAdmin() {
  if (getSession()?.user.role !== 'ADMINISTRADOR') throw new ApiError('Administración de categorías restringida al administrador.', 403)
}
export const categorySaveKey = (id: string | null, input: CategoryInput) => id ? 'category-update:' + id : 'category-create:' + JSON.stringify(input)
export const categoryDeleteKey = (id: string) => 'category-delete:' + id
export async function readCategory(id: string, signal?: AbortSignal) {
  requireAdmin()
  const result = await authenticatedRequest<Category>(path(id), { signal })
  if (result?.id !== id || typeof result.activo !== 'boolean') throw new ApiError('Resumen de categoría incompatible.', 0)
  return result
}
export async function readCategoryPolicies(id: string, signal?: AbortSignal) {
  requireAdmin()
  const result = await authenticatedRequest<CategoryPolicies>(path(id) + '/policies', { signal })
  if (!result || !['COMPLETE', 'INCOMPLETE', 'UNAVAILABLE'].includes(result.status) || result.rulesEditable !== false || !Array.isArray(result.policies) ||
    result.policies.some(policy => !policy?.id || !policy.criteria || typeof policy.criteria.condition !== 'string' ||
      (policy.criteria.access && !Array.isArray(policy.criteria.access.allowedLevels)) || (policy.criteria.trust && !Array.isArray(policy.criteria.trust.levels))))
    throw new ApiError('Configuración publicada no disponible de forma segura.', 0)
  return result
}
export async function saveCategory(id: string | null, input: CategoryInput) {
  requireAdmin()
  if (!input.nombre.trim() || input.nombre.length > 120 || (input.descripcion?.length ?? 0) > 2000 ||
    !Number.isInteger(input.tiempoMaximoPrestamoHoras) || input.tiempoMaximoPrestamoHoras < 1 || input.tiempoMaximoPrestamoHoras > 2147483647 ||
    !Number.isInteger(input.tiempoMaximoPrestamoDias) || input.tiempoMaximoPrestamoDias < 1)
    throw new ApiError('Revisa el nombre, la descripción y la duración entera positiva.', 400)
  return guardedMutation(categorySaveKey(id, input), async () => {
    const result = await authenticatedRequest<Category>(id ? path(id) : '/inventory/categories', { method: id ? 'PATCH' : 'POST', body: input })
    if (!result?.id || (id && result.id !== id) || !categoryMatches(result, input))
      throw new ApiError('El servidor no confirmó la categoría. Consulta su estado antes de repetir.', 0)
    return result
  })
}
export const categoryMatches = (category: Category, input: CategoryInput) => category.nombre === input.nombre && category.descripcion === input.descripcion &&
  category.activo === input.activo && category.tiempoMaximoPrestamoHoras === input.tiempoMaximoPrestamoHoras && category.tiempoMaximoPrestamoDias === input.tiempoMaximoPrestamoDias
export async function setCategoryActive(id: string, activo: boolean) {
  requireAdmin()
  return guardedMutation('category-active:' + id, async () => {
    const result = await authenticatedRequest<Category>(path(id), { method: 'PATCH', body: { activo } })
    if (result?.id !== id || result.activo !== activo) throw new ApiError('Estado no confirmado. Consulta la categoría.', 0)
    return result
  })
}
export async function readDeletionPreview(id: string, signal?: AbortSignal) {
  requireAdmin()
  const result = await authenticatedRequest<DeletionPreview>(path(id) + '/deletion-preview', { signal })
  if (result?.categoryId !== id || !Array.isArray(result.blockers) || !Array.isArray(result.resourceIds) || !Array.isArray(result.copyIds) ||
    !Array.isArray(result.accessoryIds) || typeof result.canDelete !== 'boolean' || !result.wouldDelete ||
    (result.canDelete && result.blockers.length > 0)) throw new ApiError('Previsualización incompatible; no se permite eliminar.', 0)
  return result
}
export async function deleteCategory(id: string) {
  requireAdmin()
  return guardedMutation(categoryDeleteKey(id), async () => {
    const result = await authenticatedRequest<{ deleted: true; categoryId: string }>(path(id), { method: 'DELETE' })
    if (result?.deleted !== true || result.categoryId !== id) throw new ApiError('El borrado no fue confirmado. Consulta antes de repetir.', 0)
    return result
  })
}
