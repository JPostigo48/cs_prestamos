import { ApiError, apiRequest } from '../../../shared/api/client'

export type AccessRole = 'USUARIO' | 'OPERADOR' | 'ADMINISTRADOR'
export interface AuthSession {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: number
  user: {
    id: string
    email: string
    role: AccessRole
    userType: 'ESTUDIANTE' | 'DOCENTE' | 'ADMINISTRATIVO'
  }
}
export interface AuthResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: AuthSession['user']
}

const SESSION_KEY = 'cs-prestamos-session'

export async function authenticate(email: string, password: string): Promise<AuthSession> {
  const response = await apiRequest<AuthResponse>('/auth/authenticate', {
    method: 'POST',
    body: { email, password },
  })
  return sessionFromResponse(response)
}

export function sessionFromResponse(response: AuthResponse): AuthSession {
  if (
    !response ||
    typeof response.accessToken !== 'string' ||
    !response.accessToken ||
    response.tokenType !== 'Bearer' ||
    !Number.isFinite(response.expiresIn) ||
    response.expiresIn <= 0 ||
    !response.user?.id ||
    !['USUARIO', 'OPERADOR', 'ADMINISTRADOR'].includes(response.user.role) ||
    !['ESTUDIANTE', 'DOCENTE', 'ADMINISTRATIVO'].includes(response.user.userType)
  ) {
    throw new ApiError('El servidor no devolvió una sesión válida.', 0)
  }
  return {
    accessToken: response.accessToken,
    tokenType: response.tokenType,
    expiresAt: Date.now() + response.expiresIn * 1000,
    user: response.user,
  }
}

export function saveSession(session: AuthSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session: AuthSession = JSON.parse(raw)
    if (
      session &&
      Number.isFinite(session.expiresAt) &&
      session.expiresAt > Date.now() &&
      typeof session.accessToken === 'string' &&
      session.accessToken.length > 0 &&
      session.tokenType === 'Bearer' &&
      typeof session.user?.id === 'string' &&
      session.user.id.length > 0 &&
      typeof session.user.email === 'string' &&
      ['USUARIO', 'OPERADOR', 'ADMINISTRADOR'].includes(session.user.role) &&
      ['ESTUDIANTE', 'DOCENTE', 'ADMINISTRATIVO'].includes(session.user.userType)
    )
      return session
  } catch {
    // La sesión inválida se elimina en el mismo paso.
  }
  clearSession()
  return null
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* El almacenamiento puede estar deshabilitado. */
  }
}

export async function authenticatedRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const session = getSession()
  if (!session) {
    window.dispatchEvent(new Event('session-expired'))
    throw new ApiError('Tu sesión ha caducado. Inicia sesión nuevamente.', 401)
  }
  return apiRequest<T>(path, { ...options, token: session.accessToken })
}

export async function submitRegistrationRequest(input: {
  name: string
  userType: 'ESTUDIANTE' | 'DOCENTE' | 'ADMINISTRATIVO'
  institutionalId?: string
  evidence: string[]
}): Promise<{ id: string; status: string }> {
  const result = await apiRequest<{ id: string; status: string }>('/users/registration-requests', {
    method: 'POST',
    body: input,
  })
  if (!result?.id || result.status !== 'PENDIENTE')
    throw new ApiError(
      'El servidor no confirmó la solicitud de registro. Verifica antes de repetir.',
      0,
    )
  return result
}
