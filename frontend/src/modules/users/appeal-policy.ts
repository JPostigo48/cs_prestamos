import type { Sanction } from './api/student-api'

// Orienta la acción visible; el servidor valida plazo y apelaciones previas.
export function canAppeal(sanction: Sanction, now = Date.now()): boolean {
  if (!sanction.violationId || sanction.status === 'ABSUELTA') return false
  const end = sanction.endsAt === null ? null : new Date(sanction.endsAt).getTime()
  const finishedAt = sanction.status === 'FINALIZADA'
    ? (end ?? new Date(sanction.startsAt).getTime())
    : (end !== null && end <= now ? end : null)
  return finishedAt === null || now <= finishedAt + 30 * 24 * 60 * 60 * 1000
}
