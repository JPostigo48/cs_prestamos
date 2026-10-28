import { authenticatedRequest } from './auth-api'
import { ApiError } from '../../../shared/api/client'
import { provisionalRequest } from '../../../shared/api/provisional-contracts'
import { guardedMutation } from '../../../shared/api/mutation-guard'
export interface Terms {
  id: string
  number: number
  title: string
  content: string
}
export const getCurrentTerms = (signal?: AbortSignal) =>
  provisionalRequest<Terms>('F02', { signal })
export const startGoogle = (email: string) =>
  provisionalRequest<{ authorizationUrl: string }>('F01', { body: { email } })
export const requestFullRegistration = (body: {
  name: string
  email: string
  password: string
  userType: string
  institutionalId?: string
  evidence: string[]
  termsVersionId: string
}) => guardedMutation('full-registration', () => provisionalRequest<{ id: string; status: 'PENDIENTE' }>('F03', { body }))
export async function acceptTerms(userId: string, termsVersionId: string) {
  const result = await authenticatedRequest<{
    id: string
    userId: string
    termsVersionId: string
    acceptedAt: string
  }>('/terms/acceptances', {
    method: 'POST',
    body: { userId, termsVersionId, acceptedAt: new Date().toISOString() },
  })
  if (!result?.id || result.userId !== userId || result.termsVersionId !== termsVersionId)
    throw new ApiError('El servidor no confirmó la aceptación.', 0)
  return result
}
