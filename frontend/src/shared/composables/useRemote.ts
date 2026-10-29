import { onScopeDispose, ref, shallowRef, watch, type WatchSource } from 'vue'
import { ApiError } from '../api/client'

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403)
    return 'Acceso denegado. Tu sesión sigue abierta; puedes volver a otra sección desde el menú.'
  if (error instanceof ApiError && (error.status === 0 || error.status >= 500))
    return 'No pudimos comunicarnos con el servicio. Intenta consultar de nuevo. Si estabas enviando una solicitud, verifica su estado antes de repetirla.'
  if (error instanceof Error && /contrato|\bF\d{2}\b|Cannot (GET|POST|PATCH|DELETE)|\/(?:api|reservations|users|terms|resources)\b/i.test(error.message))
    return 'Esta información no está disponible en este momento. Puedes volver a consultarla; si el problema continúa, contacta con el personal.'
  return error instanceof Error ? error.message : 'No se pudo completar la solicitud.'
}

// Cada bloque tiene carga, error y reintento propios. Una respuesta obsoleta no puede publicarse.
export function useRemote<T>(
  load: (signal: AbortSignal) => Promise<T>,
  source: WatchSource = () => true,
  immediate = true,
) {
  const data = shallowRef<T | null>(null)
  const error = ref('')
  const status = ref<number | null>(null)
  const loading = ref(false)
  let controller: AbortController | undefined
  let generation = 0
  async function refresh(): Promise<void> {
    const current = ++generation
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    error.value = ''
    status.value = null
    data.value = null
    try {
      const result = await load(controller.signal)
      if (current === generation) data.value = result
    } catch (cause) {
      if (current !== generation || controller.signal.aborted) return
      error.value = errorMessage(cause)
      status.value = cause instanceof ApiError ? cause.status : null
    } finally {
      if (current === generation) loading.value = false
    }
  }
  watch(
    source,
    () => {
      void refresh()
    },
    { immediate },
  )
  onScopeDispose(() => {
    generation++
    controller?.abort()
  })
  return { data, error, status, loading, refresh }
}
