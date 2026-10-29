import { authenticatedRequest, sessionFromResponse, type AuthResponse } from './auth-api'
import { ApiError, apiRequest } from '../../../shared/api/client'
import { guardedMutation } from '../../../shared/api/mutation-guard'
export interface Terms {
  id: string
  number: number
  title: string
  content: string
}
export async function getCurrentTerms(signal?: AbortSignal) {
  const result = await apiRequest<Terms>('/terms/current', { signal })
  if (!result?.id || !Number.isInteger(result.number) || result.number < 1 || !result.title?.trim() || !result.content?.trim())
    throw new ApiError('No hay una versión de términos legible disponible. Contacta con el personal.', 422)
  return result
}
export async function startGoogle(email: string) {
  const result = await apiRequest<{ authorizationUrl: string }>('/auth/google/authorization', { method: 'POST', body: { email } })
  let url: URL
  try { url = new URL(result.authorizationUrl) } catch { throw new ApiError('Google no devolvió una autorización válida.', 422) }
  if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com' || url.username || url.password)
    throw new ApiError('Google no devolvió una autorización segura.', 422)
  return result
}
export async function finishGoogle(code: string, state: string) {
  return sessionFromResponse(await apiRequest<AuthResponse>('/auth/google/authenticate', { method: 'POST', body: { code, state } }))
}
export const requestFullRegistration = (body: {
  name: string
  email: string
  password: string
  userType: string
  institutionalId?: string
  evidence: string[]
  termsVersionId: string
}) => guardedMutation('full-registration', async () => {
  const result = await apiRequest<{ id: string; status: 'PENDIENTE' }>('/auth/registration-requests', { method: 'POST', body })
  if (!result?.id || result.status !== 'PENDIENTE') throw new ApiError('No se confirmó el alta. Consulta su estado antes de repetir.', 422)
  return result
})
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
