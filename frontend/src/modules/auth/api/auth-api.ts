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
// Sin secretos: impide importar copias antiguas después de un cierre de sesión.
const MIGRATION_KEY = 'cs-prestamos-session-migrated'

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
  try {
    localStorage.setItem(MIGRATION_KEY, '1')
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    removeLegacySession()
  } catch {
    throw new ApiError(
      'No se pudo guardar la sesión compartida. Habilita el almacenamiento del navegador e intenta nuevamente.',
      0,
    )
  }
}

function removeLegacySession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // No usamos almacenamiento por pestaña como alternativa silenciosa.
  }
}

function parseSession(raw: string): AuthSession | null {
  try {
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
    // JSON inválido tampoco es una sesión.
  }
  return null
}

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw !== null) {
      localStorage.setItem(MIGRATION_KEY, '1')
      removeLegacySession()
      const session = parseSession(raw)
      if (!session) localStorage.removeItem(SESSION_KEY)
      return session
    }
    const migrated = localStorage.getItem(MIGRATION_KEY)
    const legacy = migrated ? null : sessionStorage.getItem(SESSION_KEY)
    removeLegacySession()
    // Una pestaña sin legado no debe impedir la primera migración de otra.
    // Logout y eventos remotos sí dejan siempre el marcador.
    if (legacy === null) return null
    localStorage.setItem(MIGRATION_KEY, '1')
    const session = legacy ? parseSession(legacy) : null
    if (session) saveSession(session) // Conserva exactamente expiresAt.
    return session
  } catch {
    removeLegacySession()
    return null // Almacenamiento bloqueado: acceso cerrado, nunca éxito ficticio.
  }
}

export function clearSession(): void {
  removeLegacySession()
  try {
    localStorage.removeItem(SESSION_KEY)
    localStorage.setItem(MIGRATION_KEY, '1')
  } catch {
    /* El almacenamiento puede estar deshabilitado. */
  }
}

/** Solo cambios de sesión compartida; no mutaciones pendientes ni sessionStorage. */
export function subscribeSessionChanges(listener: (session: AuthSession | null) => void): () => void {
  const handleStorage = (event: StorageEvent): void => {
    let session: AuthSession | null
    try {
      if (event.storageArea !== localStorage) return
      if (event.key !== SESSION_KEY && event.key !== null) return
      removeLegacySession()
      // clear() también borra el marcador; restaurarlo antes de leer el legado.
      localStorage.setItem(MIGRATION_KEY, '1')
      session = getSession()
    } catch {
      session = null
    }
    listener(session)
  }
  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
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
