import { ApiError } from './client'
import { getSession } from '../../modules/auth/api/auth-api'
import { shallowReactive } from 'vue'

const pending = shallowReactive(new Map<string, string>())
function key(operation: string) {
  return 'cs-mutation-pending:' + (getSession()?.user.id ?? 'public') + ':' + operation
}
export function pendingMutation(operation: string): boolean {
  const id = key(operation)
  return !!marker(id)
}
function marker(id: string): string | null {
  try {
    return pending.get(id) ?? sessionStorage.getItem(id)
  } catch {
    return pending.get(id) ?? null
  }
}
function set(id: string, value: string | null) {
  if (value) pending.set(id, value)
  else pending.delete(id)
  try {
    if (value) sessionStorage.setItem(id, value)
    else sessionStorage.removeItem(id)
  } catch {
    /* Conserva el bloqueo en memoria. */
  }
}
// Guarda identificadores e intenciones de inventario, nunca credenciales ni motivos personales.
export async function guardedMutation<T>(operation: string, run: () => Promise<T>): Promise<T> {
  // La identidad pertenece a la operación, no a la sesión que exista al recibir la respuesta.
  const id = key(operation)
  if (marker(id))
    throw new ApiError(
      'Envío anterior pendiente o resultado incierto. Consulta el estado antes de repetir. No hay reintento automático.',
      0,
    )
  const token = Date.now() + ':' + Math.random().toString(36).slice(2)
  set(id, token)
  try {
    const result = await run()
    if (marker(id) === token) set(id, null)
    return result
  } catch (cause) {
    if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && marker(id) === token)
      set(id, null)
    throw cause
  }
}
// Solo se reconcilia con una respuesta de lectura que confirme la operación, no con su ausencia.
export function confirmMutation(operation: string): void {
  set(key(operation), null)
}

// Capturar ANTES de una lectura asíncrona; una respuesta tardía no reconcilia otra cuenta.
export function mutationConfirmation(): (operation: string) => boolean {
  const owner = getSession()?.user.id ?? 'public'
  const prefix = 'cs-mutation-pending:' + owner + ':'
  const observed = new Map(pending)
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const id = sessionStorage.key(i)
      if (id?.startsWith(prefix)) observed.set(id, sessionStorage.getItem(id)!)
    }
  } catch { /* El respaldo en memoria sigue disponible. */ }
  return (operation) => {
    const id = prefix + operation, original = observed.get(id)
    if (!original || marker(id) !== original) return false
    set(id, null)
    return true
  }
}
