import { authenticatedRequest } from '../../auth/api/auth-api'
import { ApiError } from '../../../shared/api/client'
import { provisionalRequest } from '../../../shared/api/provisional-contracts'
import type { Sanction } from '../../users/api/student-api'
import { guardedMutation, mutationConfirmation } from '../../../shared/api/mutation-guard'
import { validPeriod } from '../../../shared/api/calendar'
export interface Appeal {
  id: string
  userId: string
  sanctionId: string | null
  reason: string
  submittedAt: string
  status: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA'
  resolution: string | null
}
export async function listAppeals(status: string, signal?: AbortSignal) {
  const confirmMutation = mutationConfirmation()
  const result = await provisionalRequest<{ items: Appeal[]; total: number }>('F04', {
    query: status ? { status } : {},
    signal,
  })
  for (const item of result.items)
    if (item.status !== 'PENDIENTE') confirmMutation('resolve:' + item.id)
  return result
}
export async function resolveAppeal(
  id: string,
  status: 'ACEPTADA' | 'RECHAZADA',
  resolution: string,
) {
  if (!id.trim() || !resolution.trim() || resolution.length > 2000)
    throw new ApiError('Identificador y fundamento de hasta 2000 caracteres obligatorios.', 400)
  return guardedMutation('resolve:' + id, async () => {
    const result = await authenticatedRequest<Appeal>(
      '/appeals/' + encodeURIComponent(id) + '/resolution',
      { method: 'PATCH', body: { status, resolution: resolution.trim() } },
    )
    if (result?.id !== id || result.status !== status || !result.resolution)
      throw new ApiError('El servidor no confirmó la resolución. Consulta antes de repetir.', 0)
    return result
  })
}
export const suspendUser = async (
  userId: string,
  body: { reason: string; startsAt: string; endsAt: string | null },
) => {
  const now = Date.now()
  if (!userId || !body.reason.trim() || !validPeriod(body.startsAt, body.endsAt) || (body.endsAt !== null && Date.parse(body.endsAt) <= now))
    throw new ApiError('Motivo y periodo de suspensión válidos obligatorios.', 400)
  const expectedStatus = Date.parse(body.startsAt) > now ? 'PROGRAMADA' : 'ACTIVA'
  return guardedMutation('suspend:' + userId, async () => {
    const result = await provisionalRequest<{ id: string; userId: string; status: string; startsAt: string; endsAt: string | null }>('F11', {
      params: { userId },
      body,
    })
    if (result.userId !== userId || result.status !== expectedStatus || Date.parse(result.startsAt) !== Date.parse(body.startsAt) || (result.endsAt === null ? body.endsAt !== null : body.endsAt === null || Date.parse(result.endsAt) !== Date.parse(body.endsAt)))
      throw new ApiError('El servidor no confirmó la suspensión y el periodo solicitados para este usuario.', 0)
    return result
  })
}
export async function liftSanction(sanctionId: string, resolution: string) {
  return guardedMutation('lift:' + sanctionId, async () => {
  const result = await provisionalRequest<Sanction>('F12', {
    params: { sanctionId },
    body: { resolution },
  })
  if (result.id !== sanctionId) throw new ApiError('El servidor respondió por otra sanción.', 0)
  return result
  })
}
