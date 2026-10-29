import { authenticatedRequest, getSession } from '../../auth/api/auth-api'
import { ApiError } from '../../../shared/api/client'
import { isStaff } from '../../auth/access-policy'
import { pagination, parsePage, validSnapshot, type CopyLoanSnapshot } from './loan-contracts'
import type { Loan } from './loans-api'
import { guardedMutation, mutationConfirmation } from '../../../shared/api/mutation-guard'
export interface Reservation {
  id: string
  userId: string
  copyId: string
  requestedAt: string
  pickupDeadline: string
  loanDurationHours: number
  pickedUpAt: string | null
  cancelledAt: string | null
  status: 'CONFIRMADA' | 'RECOGIDA' | 'CANCELADA' | 'VENCIDA'
  cancellationReason: string | null
  loanId: string | null
  configurationSnapshot: CopyLoanSnapshot | null
}
export async function listReservations(query: Record<string, string>, signal?: AbortSignal) {
  const session = getSession()
  const owner = session?.user.id
  const staff = isStaff(session?.user.role ?? 'USUARIO')
  if (!owner || (!staff && query.userId && query.userId !== owner))
    throw new ApiError('Solo puedes consultar tus propias reservas.', 403)
  const { page, limit } = pagination(query)
  if (query.status && !['CONFIRMADA', 'RECOGIDA', 'CANCELADA', 'VENCIDA'].includes(query.status)) throw new ApiError('Estado inválido.', 400)
  const confirmMutation = mutationConfirmation()
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  for (const key of ['status', 'userId', 'copyId']) if (query[key]) params.set(key, query[key])
  if (!staff) params.set('userId', owner)
  const payload = await authenticatedRequest<unknown>('/loans/reservations?' + params, { signal })
  const result = parsePage<Reservation>(payload, value => {
    const r = value as Reservation | null
    return !!r && typeof r.id === 'string' && typeof r.copyId === 'string' && typeof r.userId === 'string' &&
      typeof r.requestedAt === 'string' && typeof r.pickupDeadline === 'string' &&
      ['CONFIRMADA', 'RECOGIDA', 'CANCELADA', 'VENCIDA'].includes(r.status) &&
      validSnapshot(r.configurationSnapshot) && (r.configurationSnapshot === null || r.configurationSnapshot.copyId === r.copyId) &&
      (staff || r.userId === owner) && (!query.userId || r.userId === query.userId) &&
      (!query.copyId || r.copyId === query.copyId) && (!query.status || r.status === query.status)
  }, page, limit)
  for (const item of result.items) {
    if (
      item.userId === owner &&
      item.status === 'CONFIRMADA' &&
      new Date(item.pickupDeadline).getTime() >= Date.now()
    )
      confirmMutation('reserve:' + item.copyId)
    if (item.status === 'RECOGIDA') confirmMutation('pickup:' + item.id)
    if (item.status === 'CANCELADA') confirmMutation('cancel:' + item.id)
  }
  return result
}
export async function createReservation(copyId: string, requestedAt: string) {
  const owner = getSession()?.user.id
  const instant = new Date(requestedAt)
  if (!copyId || !Number.isFinite(instant.getTime()) || instant.getTime() <= Date.now())
    throw new ApiError('Selecciona un ejemplar y una fecha futura.', 400)
  return guardedMutation('reserve:' + copyId, async () => {
    const result = await authenticatedRequest<Reservation>('/loans/reservations', {
      method: 'POST',
      body: { copyId, requestedAt: instant.toISOString() },
    })
    if (
      !result?.id ||
      result.copyId !== copyId ||
      result.userId !== owner ||
      result.status !== 'CONFIRMADA' ||
      !result.pickupDeadline
    )
      throw new ApiError(
        'Resultado incierto: el servidor no confirmó la reserva. Consulta antes de repetir.',
        0,
      )
    return result
  })
}
export async function cancelReservation(id: string, reason: string, owner?: string) {
  if (owner && getSession()?.user.id !== owner) throw new ApiError('La reserva pertenece a otra sesión.', 403)
  return guardedMutation('cancel:' + id, async () => {
    const result = await authenticatedRequest<Reservation>(
      '/loans/reservations/' + encodeURIComponent(id),
      { method: 'DELETE', body: reason.trim() ? { reason: reason.trim() } : {} },
    )
    if (result?.id !== id || result.status !== 'CANCELADA' || (owner && result.userId !== owner))
      throw new ApiError('El servidor no confirmó la cancelación.', 0)
    return result
  })
}
export async function pickupReservation(id: string) {
  return guardedMutation('pickup:' + id, async () => {
    const result = await authenticatedRequest<Loan>(
      '/loans/reservations/' + encodeURIComponent(id) + '/pickup',
      { method: 'POST' },
    )
    if (!result?.id || result.status !== 'ACTIVO' || !result.copyId || !result.userId)
      throw new ApiError(
        'El servidor no confirmó la entrega. Consulta los activos antes de repetir.',
        0,
      )
    return result
  })
}
