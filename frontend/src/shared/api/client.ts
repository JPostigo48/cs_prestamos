export class ApiError extends Error {
  readonly code?: 'SCHEMA_CAPABILITY_UNAVAILABLE'
  readonly operation?: string
  readonly diagnostic?: 'SCHEMA_INCOMPLETE' | 'SCHEMA_UNKNOWN'

  constructor(message: string, readonly status: number, metadata?: {
    code: 'SCHEMA_CAPABILITY_UNAVAILABLE'
    operation?: string
    diagnostic?: 'SCHEMA_INCOMPLETE' | 'SCHEMA_UNKNOWN'
  }) {
    super(message)
    this.name = 'ApiError'
    this.code = metadata?.code
    this.operation = metadata?.operation
    this.diagnostic = metadata?.diagnostic
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

let unauthorizedHandler: ((token: string) => void) | undefined
export function onUnauthorized(handler: (token: string) => void): void {
  unauthorizedHandler = handler
}

export async function apiRequest<T>(
  path: string,
  options: { token?: string; method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(baseUrl + path, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('No se pudo conectar con el servidor. Comprueba que el backend esté iniciado.', 0)
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && options.token) unauthorizedHandler?.(options.token)
    if (response.status === 503 && payload && typeof payload === 'object'
      && 'code' in payload && payload.code === 'SCHEMA_CAPABILITY_UNAVAILABLE') {
      // Only the stable capability envelope is projected. Never echo SQL/provider details.
      const operation = 'operation' in payload && typeof payload.operation === 'string'
        && payload.operation.length <= 96 && /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*){1,3}$/.test(payload.operation)
        ? payload.operation : undefined
      const diagnostic = 'diagnostic' in payload
        && (payload.diagnostic === 'SCHEMA_INCOMPLETE' || payload.diagnostic === 'SCHEMA_UNKNOWN')
        ? payload.diagnostic : undefined
      throw new ApiError(
        'La operación no está disponible temporalmente. Intente nuevamente más tarde.'
          + ' [SCHEMA_CAPABILITY_UNAVAILABLE' + (operation ? ': ' + operation : '') + ']',
        response.status,
        { code: 'SCHEMA_CAPABILITY_UNAVAILABLE', operation, diagnostic },
      )
    }
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? (payload as { message: unknown }).message
      : null
    throw new ApiError(
      Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : 'No se pudo completar la solicitud.',
      response.status,
    )
  }
  return payload as T
}
