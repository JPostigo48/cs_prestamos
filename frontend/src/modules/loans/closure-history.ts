import type { Loan } from './api/loans-api'

// La ausencia legacy no acredita capacidad; no convertir colecciones vacías en ausencia de efectos.
export function closureHistoryMessage(loan: Pick<Loan, 'closureHistory' | 'closure'>): string {
  if (loan.closureHistory !== 'AVAILABLE') return 'Historial de cierre no disponible. No se puede confirmar la ausencia de consecuencias ni de recompensa.'
  return loan.closure ? '' : 'No se encontró un cierre integral persistido. Puede existir una devolución antigua.'
}
