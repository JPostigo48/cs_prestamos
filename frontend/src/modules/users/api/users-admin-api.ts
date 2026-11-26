import { authenticatedRequest, type AccessRole } from '../../auth/api/auth-api'
import { ApiError } from '../../../shared/api/client'
import type { UserProfile } from './student-api'
export interface Page<T> {
  items: T[]
  total: number
  page: number
  limit: number
}
export interface SafeAccount {
  id: string
  userId: string
  email: string
  role: AccessRole
  enabled: boolean
  lastAccessAt: string | null
}
export interface RegistrationRequest {
  id: string
  name: string
  userType: string
  institutionalId: string | null
  status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  evidence: { information: string }[]
  approvedUserId: string | null
  rejectionReason: string | null
  approvalBlockers: string[]
}
const queryString = (query: Record<string, string>) =>
  new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '')).toString()
export const listUsers = (query: Record<string, string>, signal?: AbortSignal) =>
  authenticatedRequest<Page<UserProfile>>('/users?' + queryString(query), { signal })
export const listRegistrationRequests = (query: Record<string, string>, signal?: AbortSignal) =>
  authenticatedRequest<Page<RegistrationRequest>>(
    '/users/registration-requests?' + queryString(query),
    { signal },
  )
export async function findAccount(userId: string, signal?: AbortSignal) {
  const result = await authenticatedRequest<{ items: SafeAccount[] }>('/auth/accounts?' + new URLSearchParams({ userId }), {
    signal,
  })
  if (!Array.isArray(result?.items) || result.items.length !== 1 || result.items[0]!.userId !== userId || !result.items[0]!.id || typeof result.items[0]!.enabled !== 'boolean' || !['USUARIO', 'OPERADOR', 'ADMINISTRADOR'].includes(result.items[0]!.role))
    throw new ApiError(
      'No se encontró una única cuenta para este usuario. No se enviará el ID de usuario como ID de cuenta.',
      409,
    )
  return result.items[0]!
}
export async function updateRole(account: SafeAccount, role: 'USUARIO' | 'OPERADOR') {
  if (account.role === 'ADMINISTRADOR')
    throw new ApiError('No se permite modificar administradores desde este control.', 403)
  const result = await authenticatedRequest<SafeAccount>(
    '/auth/accounts/' + encodeURIComponent(account.id),
    { method: 'PATCH', body: { role } },
  )
  if (result?.id !== account.id || result.userId !== account.userId || result.role !== role)
    throw new ApiError('No se confirmó el cambio de rol.', 0)
  return result
}
export async function approveRequest(id: string) {
  const result = await authenticatedRequest<{ request: RegistrationRequest; user: UserProfile }>(
    '/users/registration-requests/' + encodeURIComponent(id) + '/approve',
    { method: 'POST' },
  )
  if (result?.request?.id !== id || result.request.status !== 'APROBADA' || !result.user?.id)
    throw new ApiError('El servidor no confirmó la aprobación.', 0)
  return result
}
export async function rejectRequest(id: string, rejectionReason: string) {
  const result = await authenticatedRequest<RegistrationRequest>(
    '/users/registration-requests/' + encodeURIComponent(id) + '/reject',
    {
      method: 'POST',
      body: rejectionReason.trim() ? { rejectionReason: rejectionReason.trim() } : {},
    },
  )
  if (result?.id !== id || result.status !== 'RECHAZADA')
    throw new ApiError('El servidor no confirmó el rechazo.', 0)
  return result
}
export async function getRegistrationEvidenceUrl(
  requestId: string,
  evidenceIndex: number,
  signal?: AbortSignal,
) {
  const result = await authenticatedRequest<{ url: string }>(
    '/users/registration-requests/' +
      encodeURIComponent(requestId) +
      '/evidence/' +
      evidenceIndex,
    { signal },
  )
  try {
    const url = new URL(result?.url)
    const prefix = '/storage/v1/object/sign/'
    const parts = decodeURIComponent(url.pathname.slice(prefix.length)).split('/')
    if (url.protocol !== 'https:' || url.username || url.password || url.hash
      || !url.pathname.startsWith(prefix) || parts.length !== 3 || !parts[0]
      || parts[1] !== 'registration-evidence' || !/^[a-f\d-]{36}\.pdf$/i.test(parts[2]!)
      || !url.searchParams.get('token')) throw new Error('invalid')
    return url.href
  } catch { throw new ApiError('No se recibió un enlace firmado seguro para la evidencia. Vuelve a intentarlo.', 422) }
}
export async function createAccount(body: { userId: string; email: string; password: string }) {
  const result = await authenticatedRequest<SafeAccount>('/auth/accounts', {
    method: 'POST',
    body: { ...body, role: 'USUARIO' },
  })
  if (!result?.id || result.userId !== body.userId || result.role !== 'USUARIO')
    throw new ApiError('No se confirmó la cuenta. Verifica antes de repetir.', 0)
  return result
}
