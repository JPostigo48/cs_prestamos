import { authenticatedRequest, getSession } from '../../auth/api/auth-api'
import { ApiError } from '../../../shared/api/client'
import { guardedMutation, pendingMutation } from '../../../shared/api/mutation-guard'
import { shallowReactive } from 'vue'
import type { Loan } from '../../loans/api/loans-api'
export type { Loan } from '../../loans/api/loans-api'

export interface UserProfile {
  id: string
  name: string
  userType: 'ESTUDIANTE' | 'DOCENTE' | 'ADMINISTRATIVO'
  institutionalId: string | null
  hasCurrentAffiliation: boolean
  trustPercentage: number
}
export interface TrustProfile {
  userId: string
  percentage: number
  level: 'CRITICO' | 'EN_OBSERVACION' | 'CONFIABLE' | 'EXCELENTE'
  currentlyPenalized: boolean
}
export interface LoanEligibility {
  userId: string
  enabled: boolean
  reasons?: string[]
}
export interface Sanction {
  id: string
  status: 'PROGRAMADA' | 'ACTIVA' | 'FINALIZADA' | 'ABSUELTA'
  startsAt: string
  endsAt: string | null
  previousTrust: number
  resultingTrust: number
  ruleId: string | null
  violationId: string | null
}
export const getUser = (id: string, signal?: AbortSignal) =>
  authenticatedRequest<UserProfile>('/users/' + encodeURIComponent(id), { signal })
export const getTrust = (id: string, signal?: AbortSignal) =>
  authenticatedRequest<TrustProfile>('/users/' + encodeURIComponent(id) + '/trust', { signal })
export const getEligibility = (id: string, signal?: AbortSignal) =>
  authenticatedRequest<LoanEligibility>('/users/' + encodeURIComponent(id) + '/loan-eligibility', {
    signal,
  })
export const getSanctions = (id: string, signal?: AbortSignal) =>
  authenticatedRequest<Sanction[]>('/users/' + encodeURIComponent(id) + '/sanctions', { signal })
export const getHistory = (id: string, signal?: AbortSignal) =>
  authenticatedRequest<Loan[]>('/loans/user/' + encodeURIComponent(id) + '/history', { signal })
export interface AppealConfirmation { id: string; status: 'PENDIENTE'; userId: string; sanctionId: string }
const confirmedAppeals = shallowReactive(new Map<string, AppealConfirmation>())
const appealDrafts = shallowReactive(new Map<string, string>())
const appealKey = (sanctionId: string, owner = getSession()?.user.id) => owner + ':' + sanctionId
export function confirmedAppeal(sanctionId: string) {
  return confirmedAppeals.get(appealKey(sanctionId))
}
export function appealDraft(sanctionId: string) {
  return appealDrafts.get(appealKey(sanctionId))
}
export function appealBlocked(sanctionId: string) {
  return !!confirmedAppeal(sanctionId) || pendingMutation('appeal:' + sanctionId)
}
export async function submitAppeal(sanctionId: string, reason: string) {
  const owner = getSession()?.user.id
  const key = appealKey(sanctionId, owner)
  if (!owner || !sanctionId || !reason.trim() || reason.trim().length > 2000)
    throw new ApiError('Usuario, sanción y motivo válido obligatorios.', 400)
  if (confirmedAppeals.has(key)) throw new ApiError('Esta apelación ya fue confirmada.', 409)
  return guardedMutation('appeal:' + sanctionId, async () => {
    appealDrafts.set(key, reason)
    const result = await authenticatedRequest<AppealConfirmation>(
      '/sanctions/' + encodeURIComponent(sanctionId) + '/appeals',
      { method: 'POST', body: { reason: reason.trim() } },
    )
    if (typeof result?.id !== 'string' || !result.id.trim() || result.status !== 'PENDIENTE' || result.userId !== owner || result.sanctionId !== sanctionId)
      throw new ApiError('Resultado incierto: no se confirmó una apelación pendiente de tu sanción. Conserva el motivo y consulta antes de repetir.', 0)
    confirmedAppeals.set(key, result)
    appealDrafts.delete(key)
    return result
  })
}
