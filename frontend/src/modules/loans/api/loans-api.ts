import { authenticatedRequest, getSession } from '../../auth/api/auth-api'
import type { ReturnInput } from '../return-policy'
import { ApiError } from '../../../shared/api/client'
import { provisionalRequest } from '../../../shared/api/provisional-contracts'

export interface Loan {
  id: string
  userId: string
  copyId: string
  startsAt: string
  endsAt: string
  status: 'PLANIFICADO' | 'ACTIVO' | 'FINALIZADO'
  return: { returnedAt: string; observation?: string | null } | null
}
export const getActiveLoans = (signal?: AbortSignal) =>
  authenticatedRequest<Loan[]>('/loans/active', { signal })
export const getOverdueLoans = (signal?: AbortSignal) =>
  authenticatedRequest<Loan[]>('/loans/overdue', { signal })
export async function getLoan(id: string): Promise<Loan> {
  const result = await authenticatedRequest<Loan>('/loans/' + encodeURIComponent(id))
  if (!result || result.id !== id || !['ACTIVO', 'FINALIZADO', 'PLANIFICADO'].includes(result.status)) throw new ApiError('Respuesta incompatible con el préstamo solicitado.', 0)
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
  const result = await provisionalRequest<{
    id: string
    loanId: string
    parts: { accessoryId: string; received: boolean }[]
    checkedAt: string
  }>('F09', { params: { loanId }, body: { parts, checkedAt: new Date().toISOString() } })
  if (
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
