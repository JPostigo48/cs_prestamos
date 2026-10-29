import { authenticatedRequest, getSession } from '../../auth/api/auth-api'
import { ApiError } from '../../../shared/api/client'
import { guardedMutation, mutationConfirmation } from '../../../shared/api/mutation-guard'
import { validInstant } from '../../../shared/api/calendar'
import { validAppeal, validRule, validSanctionDetail, validSuspension, manualSuspensionRule, uuid, record, type Appeal, type AppealPage, type RuleVersion, type SanctionDetail } from './trust-contracts'
export type { Appeal, AppealPage, RuleVersion, SanctionDetail } from './trust-contracts'
export interface AppealQuery { status?: string; userId?: string; sanctionId?: string; page?: number; limit?: number }
function administrator() {
  if (getSession()?.user.role !== 'ADMINISTRADOR') throw new ApiError('Solo administración puede realizar esta acción.', 403)
}
export async function listAppeals(filter: string | AppealQuery = {}, signal?: AbortSignal): Promise<AppealPage> {
  const query = typeof filter === 'string' ? { status: filter } : filter
  const page = query.page ?? 1, limit = query.limit ?? 20
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
    (query.status && !['PENDIENTE', 'ACEPTADA', 'RECHAZADA'].includes(query.status)) ||
    (query.userId && !uuid(query.userId)) || (query.sanctionId && !uuid(query.sanctionId))) throw new ApiError('Filtros de apelaciones inválidos.', 400)
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  for (const key of ['status', 'userId', 'sanctionId'] as const) if (query[key]) params.set(key, query[key]!)
  const confirmMutation = mutationConfirmation()
  const owner = getSession()?.user
  const result = await authenticatedRequest<AppealPage>('/appeals?' + params, { signal })
  if (!record(result) || !Array.isArray(result.items) || !result.items.every(validAppeal) ||
    !Number.isSafeInteger(result.total) || result.total < 0 || result.page !== page || result.limit !== limit || result.items.length > limit || result.total < result.items.length ||
    result.items.some(a => (query.status && a.status !== query.status) || (query.userId && a.userId !== query.userId) || (query.sanctionId && a.sanctionId !== query.sanctionId) || (owner?.role === 'USUARIO' && a.userId !== owner.id)))
    throw new ApiError('Respuesta de apelaciones inválida o de otro titular.', 0)
  for (const item of result.items)
    if (item.status !== 'PENDIENTE') confirmMutation('resolve:' + item.id)
  return result
}
export async function getSanction(id: string, signal?: AbortSignal) {
  if (!id.trim()) throw new ApiError('Sanción obligatoria.', 400)
  const owner = getSession()?.user
  const confirm = mutationConfirmation()
  const result = await authenticatedRequest<SanctionDetail>('/sanctions/' + encodeURIComponent(id), { signal })
  if (!validSanctionDetail(result) || result.id !== id || (owner?.role === 'USUARIO' && result.userId !== owner.id)) throw new ApiError('Respuesta de sanción inválida o de otro titular.', 0)
  if (result.status === 'FINALIZADA') confirm('lift:' + id)
  return result
}
export async function listSuspensionRules(signal?: AbortSignal) {
  const result = await authenticatedRequest<RuleVersion[]>('/rules/active', { signal })
  if (!Array.isArray(result) || !result.every(validRule)) throw new ApiError('Listado de reglas inválido.', 0)
  return result.filter(manualSuspensionRule)
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
  body: { ruleId: string; reason: string; requestId?: string; startsAt?: string; endsAt?: string | null },
) => {
  administrator()
  const now = Date.now()
  if (!userId || !uuid(body.ruleId ?? '') || !body.reason.trim() || body.reason.length > 2000 ||
    (body.requestId !== undefined && !uuid(body.requestId)) ||
    (body.startsAt !== undefined && !validInstant(body.startsAt)) ||
    (body.endsAt !== undefined && body.endsAt !== null && (!validInstant(body.endsAt) || Date.parse(body.endsAt) <= Math.max(now, body.startsAt ? Date.parse(body.startsAt) : now))))
    throw new ApiError('Regla, motivo de hasta 2000 caracteres y periodo válidos obligatorios.', 400)
  return guardedMutation('suspend:' + userId, async () => {
    const result = await authenticatedRequest<SanctionDetail>('/users/' + encodeURIComponent(userId) + '/suspensions', {
      method: 'POST', body: { ...body, reason: body.reason.trim(), requestId: body.requestId ?? crypto.randomUUID() },
    })
    if (!validSuspension(result) || result.userId !== userId || result.ruleId !== body.ruleId || !result.rule || !manualSuspensionRule(result.rule) || result.rule.ruleId !== body.ruleId ||
      (body.startsAt !== undefined && Date.parse(result.startsAt) !== Date.parse(body.startsAt)) ||
      (body.endsAt !== undefined && (body.endsAt === null ? result.endsAt !== null : result.endsAt === null || Date.parse(result.endsAt) !== Date.parse(body.endsAt))) ||
      (result.status === 'PROGRAMADA' ? Date.parse(result.startsAt) <= now : Date.parse(result.startsAt) > Date.now()) ||
      (result.endsAt !== null && Date.parse(result.endsAt) <= Date.now()) ||
      (result.rule.suspensionType === 'INDEFINIDA' ? result.endsAt !== null : result.endsAt === null || Date.parse(result.endsAt) - Date.parse(result.startsAt) !== result.rule.suspensionDays! * 86400000))
      throw new ApiError('El servidor no confirmó la suspensión, regla y periodo solicitados para este usuario.', 0)
    return result
  })
}
export async function liftSanction(sanctionId: string, resolution: string) {
  administrator()
  if (!sanctionId.trim() || !resolution.trim() || resolution.length > 2000) throw new ApiError('Sanción y fundamento de hasta 2000 caracteres obligatorios.', 400)
  return guardedMutation('lift:' + sanctionId, async () => {
    const result = await authenticatedRequest<SanctionDetail>('/sanctions/' + encodeURIComponent(sanctionId) + '/lift', {
      method: 'POST', body: { resolution: resolution.trim() },
    })
    if (!validSanctionDetail(result) || result.id !== sanctionId || result.status !== 'FINALIZADA') throw new ApiError('El servidor no confirmó la finalización de la misma sanción.', 0)
    return result
  })
}
