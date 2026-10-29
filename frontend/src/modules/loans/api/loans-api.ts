import { authenticatedRequest, getSession } from '../../auth/api/auth-api'
import type { ReturnInput } from '../return-policy'
import { ApiError } from '../../../shared/api/client'
import { isStaff } from '../../auth/access-policy'
import { pagination, parsePage, validChecklist, validLoan, validLoanConfiguration, type CopyLoanSnapshot, type ReturnChecklistCapture } from './loan-contracts'
export type { CopyLoanSnapshot, ReturnChecklistCapture } from './loan-contracts'

export interface Loan {
  id: string
  userId: string
  copyId: string
  startsAt: string
  endsAt: string
  status: 'PLANIFICADO' | 'ACTIVO' | 'FINALIZADO'
  return: { returnedAt: string; observation?: string | null } | null
  configurationSnapshot: CopyLoanSnapshot | null
  returnChecklist: ReturnChecklistCapture | null
}
export async function getResourceHistory(resourceId: string, query: Record<string, string> = {}, signal?: AbortSignal) {
  if (!isStaff(getSession()?.user.role ?? 'USUARIO')) throw new ApiError('Historial restringido al personal.', 403)
  const { page, limit } = pagination(query)
  if (query.status && !['PLANIFICADO', 'ACTIVO', 'FINALIZADO'].includes(query.status)) throw new ApiError('Estado inválido.', 400)
  const params = new URLSearchParams({ page: String(page), limit: String(limit), ...(query.status ? { status: query.status } : {}) })
  const result = await authenticatedRequest<unknown>('/loans/resource/' + encodeURIComponent(resourceId) + '/history?' + params, { signal })
  return parsePage<Loan>(result, validLoan, page, limit)
}
export const getActiveLoans = (signal?: AbortSignal) =>
  authenticatedRequest<Loan[]>('/loans/active', { signal })
export const getOverdueLoans = (signal?: AbortSignal) =>
  authenticatedRequest<Loan[]>('/loans/overdue', { signal })
export async function getLoan(id: string, signal?: AbortSignal): Promise<Loan> {
  const result = await authenticatedRequest<Loan>('/loans/' + encodeURIComponent(id), { signal })
  if (!result || result.id !== id || !['ACTIVO', 'FINALIZADO', 'PLANIFICADO'].includes(result.status) ||
    !validLoanConfiguration(result as unknown as Record<string, unknown>)) throw new ApiError('Respuesta incompatible con el préstamo solicitado.', 0)
  return result
}
export function confirmsReturn(result: Loan | null, id: string): boolean {
  return !!result && result.id === id && result.status === 'FINALIZADO' && typeof result.return?.returnedAt === 'string' && Number.isFinite(new Date(result.return.returnedAt).getTime())
}
export async function reconcileReturn(id: string): Promise<boolean> {
  const owner = getSession()?.user.id ?? 'public'
  const result = await getLoan(id)
  if (!confirmsReturn(result, id)) return false
  setPendingReturn(id, false, owner)
  return true
}
export async function saveReturnChecklist(
  loanId: string,
  parts: { accessoryId: string; received: boolean }[],
) {
  if (!isStaff(getSession()?.user.role ?? 'USUARIO')) throw new ApiError('Inspección restringida al personal.', 403)
  if (new Set(parts.map(p => p.accessoryId)).size !== parts.length || parts.some(p => !p.accessoryId || typeof p.received !== 'boolean'))
    throw new ApiError('Partes inválidas o duplicadas.', 400)
  const result = await authenticatedRequest<ReturnChecklistCapture>('/loans/' + encodeURIComponent(loanId) + '/return-checklist', {
    method: 'POST', body: { parts, checkedAt: new Date().toISOString() },
  })
  if (
    !validChecklist(result) ||
    result.loanId !== loanId ||
    result.parts.length !== parts.length ||
    parts.some(
      (part) =>
        !result.parts.some(
          (p) => p.accessoryId === part.accessoryId && p.received === part.received,
        ),
    )
  )
    throw new ApiError('No se confirmó el checklist completo del préstamo.', 0)
  return result
}
export async function returnLoan(id: string, body: ReturnInput): Promise<Loan> {
  const result = await authenticatedRequest<Loan>('/loans/' + encodeURIComponent(id) + '/return', {
    method: 'POST',
    body,
  })
  if (!confirmsReturn(result, id)) {
    throw new ApiError(
      'El servidor no confirmó una devolución finalizada. Consulta el estado del préstamo.',
      0,
    )
  }
  return result
}

// Conserva el bloqueo incluso si se cierra el diálogo o se recarga la pestaña durante el envío.
const pending = new Set<string>()
const key = (id: string, owner = getSession()?.user.id ?? 'public') => 'cs-return-pending:' + owner + ':' + id
export function hasPendingReturn(id: string): boolean {
  const storageKey = key(id)
  try {
    return pending.has(storageKey) || sessionStorage.getItem(storageKey) === '1'
  } catch {
    return pending.has(storageKey)
  }
}
export function setPendingReturn(id: string, value: boolean, owner = getSession()?.user.id ?? 'public'): void {
  const storageKey = key(id, owner)
  if (value) pending.add(storageKey)
  else pending.delete(storageKey)
  try {
    if (value) sessionStorage.setItem(storageKey, '1')
    else sessionStorage.removeItem(storageKey)
  } catch {
    /* Respaldo en memoria. */
  }
}
