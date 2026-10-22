import { apiRequest } from '../../../shared/api/client'

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
interface AuthResponse {
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
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const session: AuthSession = JSON.parse(raw)
    if (session.expiresAt > Date.now() && session.accessToken && session.user?.id) return session
  } catch {
    // La sesión inválida se elimina en el mismo paso.
  }
  clearSession()
  return null
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

export function submitRegistrationRequest(input: {
  name: string
  userType: 'ESTUDIANTE' | 'DOCENTE' | 'ADMINISTRATIVO'
  institutionalId?: string
  evidence: string[]
}): Promise<{ id: string; status: string }> {
  return apiRequest('/users/registration-requests', { method: 'POST', body: input })
}
