import { authenticatedRequest, getSession } from '../../auth/api/auth-api'
import { uncertainReturn, type ReturnInput, type IncidentInput, type ClosureInput } from '../return-policy'
import { validReturnPolicy, type LoanClosure, type LoanConsequence, type LoanReward, type ClosedCopy, type LoanEvidence } from './closure-contracts'
import { ApiError } from '../../../shared/api/client'
import { isStaff } from '../../auth/access-policy'
import { pagination, parsePage, parseLoan, parseLoans, validChecklist, validLoan, validLoanConfiguration, type CopyLoanSnapshot, type ReturnChecklistCapture } from './loan-contracts'
export type { CopyLoanSnapshot, ReturnChecklistCapture } from './loan-contracts'

export interface Loan {
  id: string
  userId: string
  copyId: string
  startsAt: string
  endsAt: string
  status: 'PLANIFICADO' | 'ACTIVO' | 'FINALIZADO' | 'CERRADO_POR_INCIDENCIA'
  return: { returnedAt: string; observation?: string | null } | null
  configurationSnapshot: CopyLoanSnapshot | null
  returnChecklist: ReturnChecklistCapture | null
  closureHistory?: 'AVAILABLE' | 'UNAVAILABLE'
  closure?: LoanClosure | null
  consequences?: LoanConsequence[]
  reward?: LoanReward | null
  copy?: ClosedCopy | null
  cancelledReservationIds?: string[]
}
export async function getResourceHistory(resourceId: string, query: Record<string, string> = {}, signal?: AbortSignal) {
  if (!isStaff(getSession()?.user.role ?? 'USUARIO')) throw new ApiError('Historial restringido al personal.', 403)
  const { page, limit } = pagination(query)
  if (query.status && !['PLANIFICADO', 'ACTIVO', 'FINALIZADO', 'CERRADO_POR_INCIDENCIA'].includes(query.status)) throw new ApiError('Estado inválido.', 400)
  const params = new URLSearchParams({ page: String(page), limit: String(limit), ...(query.status ? { status: query.status } : {}) })
  const result = await authenticatedRequest<unknown>('/loans/resource/' + encodeURIComponent(resourceId) + '/history?' + params, { signal })
  const parsed = parsePage<Loan>(result, validLoan, page, limit)
  return { ...parsed, items: parsed.items.map(parseLoan) }
}
export const getActiveLoans = async (signal?: AbortSignal) =>
  parseLoans(await authenticatedRequest<unknown>('/loans/active', { signal }))
export const getOverdueLoans = async (signal?: AbortSignal) =>
  parseLoans(await authenticatedRequest<unknown>('/loans/overdue', { signal }))
export async function getLoan(id: string, signal?: AbortSignal): Promise<Loan> {
  const result = await authenticatedRequest<Loan>('/loans/' + encodeURIComponent(id), { signal })
  if (!result || result.id !== id || !validLoan(result) ||
    !validLoanConfiguration(result as unknown as Record<string, unknown>)) throw new ApiError('Respuesta incompatible con el préstamo solicitado.', 0)
  return parseLoan(result)
}
export function confirmsReturn(result: Loan | null, id: string, body?: ClosureInput, actorUserId = getSession()?.user.id): boolean {
  const operation = body ?? getPendingClosure(id)
  return !!result && !!operation && validLoan(result) && result.id === id &&
    result.closure?.requestId === operation.requestId && result.closure.actorUserId === actorUserId &&
    result.closure.reason === ('kind' in operation ? operation.kind : 'DEVOLUCION') &&
    ('inspection' in operation ? result.closure.inspection?.parts.length === operation.inspection.parts.length && operation.inspection.parts.every(p => result.closure!.inspection!.parts.some(other => other.accessoryId === p.accessoryId && other.received === p.received)) &&
      result.closure.inspection?.condition === operation.inspection.condition && result.closure.inspection?.damageSeverity === operation.inspection.damageSeverity &&
      result.closure.inspection?.description === operation.inspection.description && result.closure.inspection.evidenceIds.length === operation.inspection.evidenceIds.length && operation.inspection.evidenceIds.every(id => result.closure!.inspection!.evidenceIds.includes(id)) : result.status === 'CERRADO_POR_INCIDENCIA')
}
export async function reconcileReturn(id: string): Promise<boolean> {
  return !!await reconcileClosure(id)
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
  return submitClosure(id, body)
}

export const closeIncident = (id: string, body: IncidentInput) => submitClosure(id, body)
export async function getReturnPolicy(id: string, signal?: AbortSignal) {
  const result = await authenticatedRequest<unknown>('/loans/' + encodeURIComponent(id) + '/return-policy', { signal })
  if (!validReturnPolicy(result, id)) throw new ApiError('No se confirmó la política histórica completa.', 0)
  return result
}
export async function getLoanEvidence(id: string, signal?: AbortSignal): Promise<LoanEvidence[]> {
  const result = await authenticatedRequest<LoanEvidence[]>('/loans/' + encodeURIComponent(id) + '/evidence', { signal })
  if (!Array.isArray(result) || result.some(e => !e?.id || e.loanId !== id || !['ENTREGA', 'DEVOLUCION', 'DANO', 'PERDIDA'].includes(e.type) || typeof e.originalName !== 'string')) throw new ApiError('Evidencias incompatibles con este préstamo.', 0)
  return result
}
const operations = new Map<string, ClosureInput>()
export function getPendingClosure(id: string, owner = getSession()?.user.id ?? 'public'): ClosureInput | null {
  const storageKey = key(id, owner)
  try {
    const stored = operations.get(storageKey) ?? JSON.parse(sessionStorage.getItem(storageKey + ':body') ?? 'null')
    return stored ? structuredClone(stored) : null
  } catch { return operations.has(storageKey) ? structuredClone(operations.get(storageKey)!) : null }
}
async function submitClosure(id: string, body: ClosureInput): Promise<Loan> {
  if (!isStaff(getSession()?.user.role ?? 'USUARIO')) throw new ApiError('Cierre restringido al personal.', 403)
  const owner = getSession()?.user.id ?? 'public'
  const storageKey = key(id, owner)
  const previous = getPendingClosure(id)
  if (previous && JSON.stringify(previous) !== JSON.stringify(body)) throw new ApiError('Existe un cierre pendiente: solo se puede reenviar su mismo cuerpo y clave.', 409)
  if (hasPendingReturn(id) && !previous) throw new ApiError('Existe un envío legado pendiente sin clave recuperable. Verifica el cierre antes de actuar.', 409)
  // El cuerpo puede provenir de un ref reactivo al reabrir el diálogo; serializar
  // copia únicamente el contrato JSON y evita intentar clonar proxies de Vue.
  const frozen: ClosureInput = JSON.parse(JSON.stringify(body))
  operations.set(storageKey, frozen)
  try { sessionStorage.setItem(storageKey + ':body', JSON.stringify(frozen)) } catch { /* Respaldo en memoria. */ }
  setPendingReturn(id, true, owner)
  try {
    const result = await authenticatedRequest<Loan>('/loans/' + encodeURIComponent(id) + ('kind' in frozen ? '/close-incident' : '/return'), { method: 'POST', body: frozen, signal: AbortSignal.timeout(30000) })
    if (!confirmsReturn(result, id, frozen, owner)) throw new ApiError('El servidor no confirmó el cierre de esta operación.', 0)
    setPendingReturn(id, false, owner)
    return result
  } catch (cause) {
    if (cause instanceof ApiError && !uncertainReturn(cause.status) && cause.status !== 409) setPendingReturn(id, false, owner)
    throw cause
  }
}
export async function reconcileClosure(id: string): Promise<Loan | null> {
  const body = getPendingClosure(id)
  const owner = getSession()?.user.id ?? 'public'
  const result = await getLoan(id)
  if (!body || !confirmsReturn(result, id, body, owner) || getPendingClosure(id, owner)?.requestId !== body.requestId) return null
  setPendingReturn(id, false, owner)
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
  if (!value) operations.delete(storageKey)
  try {
    if (value) sessionStorage.setItem(storageKey, '1')
    else { sessionStorage.removeItem(storageKey); sessionStorage.removeItem(storageKey + ':body') }
  } catch {
    /* Respaldo en memoria. */
  }
}
