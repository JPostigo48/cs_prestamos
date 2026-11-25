import type { Loan } from './api/loans-api'
import { listReservations, type Reservation } from './api/reservations-api'
import { ApiError } from '../../shared/api/client'

export type HistoryState = 'DEVUELTO' | 'VENCIDO' | 'ACTIVO' | 'PROGRAMADO' | 'CERRADO_POR_INCIDENCIA'
export function historyState(loan: Pick<Loan, 'status' | 'endsAt'>, now = Date.now()): HistoryState {
  if (loan.status === 'FINALIZADO') return 'DEVUELTO'
  if (loan.status === 'CERRADO_POR_INCIDENCIA') return 'CERRADO_POR_INCIDENCIA'
  if (loan.status === 'PLANIFICADO') return 'PROGRAMADO'
  return Date.parse(loan.endsAt) < now ? 'VENCIDO' : 'ACTIVO'
}
export type OperationState = HistoryState | 'POR_RECOGER' | 'RESERVA_VENCIDA' | 'CANCELADA' | 'CONVERTIDA'
export interface PersonalOperation {
  key: string
  copyId: string
  state: OperationState
  relevantAt: string
  dateLabel: string
  loan?: Loan
  reservation?: Reservation
}

// Sin filtros de estado: un vínculo de otra página también debe participar en la unión.
export async function getPersonalReservations(userId: string, signal: AbortSignal): Promise<Reservation[]> {
  const items: Reservation[] = []
  const seen = new Set<string>()
  let total: number | undefined
  for (let page = 1; ; page++) {
    signal.throwIfAborted()
    const result = await listReservations({ userId, page: String(page), limit: '100' }, signal)
    if (total !== undefined && result.total !== total)
      throw new ApiError('El historial cambió durante la carga. Vuelve a intentar.', 409)
    total = result.total
    for (const item of result.items) {
      if (seen.has(item.id)) throw new ApiError('No se pudo completar el historial de reservas. Vuelve a intentar.', 409)
      seen.add(item.id)
      items.push(item)
    }
    if (items.length === total) return items
    if (!result.items.length || items.length > total)
      throw new ApiError('No se pudo completar el historial de reservas. Vuelve a intentar.', 409)
  }
}

export function combineHistory(loans: Loan[], reservations: Reservation[], now = Date.now()): PersonalOperation[] {
  const linked = new Map<string, Reservation>()
  for (const reservation of reservations) {
    if (reservation.loanId && reservation.status === 'RECOGIDA') linked.set(reservation.loanId, reservation)
  }
  const consumed = new Set<string>()
  const operations: PersonalOperation[] = loans.map(loan => {
    const candidate = linked.get(loan.id)
    // Un ID real y el mismo titular/ejemplar; nunca emparejar por nombre o fecha.
    const reservation = candidate && candidate.userId === loan.userId && candidate.copyId === loan.copyId ? candidate : undefined
    if (reservation) consumed.add(reservation.id)
    const state = historyState(loan, now)
    return {
      key: 'loan:' + loan.id, copyId: loan.copyId, state, loan, reservation,
      relevantAt: loan.closure?.effectiveAt ?? loan.return?.returnedAt ?? (state === 'VENCIDO' ? loan.endsAt : loan.startsAt),
      dateLabel: state === 'CERRADO_POR_INCIDENCIA' ? 'Cerrado por incidencia el' : loan.return ? 'Devuelto el' : state === 'VENCIDO' ? 'Venció el' : 'Préstamo desde',
    }
  })
  for (const reservation of reservations) {
    if (consumed.has(reservation.id)) continue
    const state: OperationState = reservation.status === 'RECOGIDA' ? 'CONVERTIDA'
      : reservation.status === 'CANCELADA' ? 'CANCELADA'
      : reservation.status === 'VENCIDA' || Date.parse(reservation.pickupDeadline) < now ? 'RESERVA_VENCIDA' : 'POR_RECOGER'
    operations.push({
      key: 'reservation:' + reservation.id, copyId: reservation.copyId, state, reservation,
      relevantAt: reservation.cancelledAt ?? reservation.pickedUpAt ?? (state === 'RESERVA_VENCIDA' ? reservation.pickupDeadline : reservation.requestedAt),
      dateLabel: state === 'CANCELADA' ? 'Cancelada el' : state === 'CONVERTIDA' ? 'Recogida el' : state === 'RESERVA_VENCIDA' ? 'Venció el' : 'Recogida desde',
    })
  }
  return operations.sort((a, b) => Date.parse(b.relevantAt) - Date.parse(a.relevantAt) || a.key.localeCompare(b.key))
}
