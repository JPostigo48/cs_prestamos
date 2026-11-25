import { ref } from 'vue'
import { ApiError } from '../../shared/api/client'
import { errorMessage } from '../../shared/composables/useRemote'
import { getPendingClosure, hasPendingReturn, reconcileClosure, returnLoan, closeIncident, type Loan } from './api/loans-api'
import { uncertainReturn, type ClosureInput } from './return-policy'

export function useLoanClosure(id: string, changed: () => void) {
  const busy = ref(false), error = ref(''), notice = ref(''), result = ref<Loan | null>(null)
  const pending = ref(getPendingClosure(id))
  const locked = ref(hasPendingReturn(id))
  const reconciled = ref(false)
  async function send(body: ClosureInput) {
    if (busy.value || result.value) return
    busy.value = true; error.value = ''
    try {
      result.value = 'kind' in body ? await closeIncident(id, body) : await returnLoan(id, body)
      locked.value = false; pending.value = null; changed()
    } catch (cause) {
      locked.value = hasPendingReturn(id)
      pending.value = getPendingClosure(id)
      reconciled.value = false
      error.value = uncertainReturn(cause instanceof ApiError ? cause.status : undefined)
        ? 'Resultado incierto. Se conservan la clave y el cuerpo; consulta el cierre antes de reintentar.' : errorMessage(cause)
      if (locked.value && uncertainReturn(cause instanceof ApiError ? cause.status : undefined)) {
        try {
          result.value = await reconcileClosure(id)
          reconciled.value = true
          if (result.value) { locked.value = false; pending.value = null; error.value = ''; changed() }
        } catch { /* Una lectura fallida no prueba que el cierre haya fallado. */ }
      }
    } finally { busy.value = false }
  }
  async function check() {
    if (busy.value) return
    busy.value = true; error.value = ''
    try {
      result.value = await reconcileClosure(id)
      reconciled.value = true
      if (result.value) { locked.value = false; pending.value = null; changed() }
      else notice.value = 'No se confirmó el cierre de esta operación. Una lectura activa no demuestra que falló; solo puede reintentarse el cuerpo original con su misma clave.'
    } catch (cause) { error.value = errorMessage(cause) }
    finally { busy.value = false }
  }
  async function retry() { if (pending.value && reconciled.value) await send(pending.value) }
  return { busy, error, notice, result, pending, locked, reconciled, send, check, retry }
}
