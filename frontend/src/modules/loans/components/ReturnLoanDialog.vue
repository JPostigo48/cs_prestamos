<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { getSession } from '../../auth/api/auth-api'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { ApiError } from '../../../shared/api/client'
import { errorMessage } from '../../../shared/composables/useRemote'
import {
  reconcileReturn,
  hasPendingReturn,
  returnLoan,
  setPendingReturn,
  type Loan,
} from '../api/loans-api'
import { returnInput, uncertainReturn } from '../return-policy'
import { dateTime } from '../../../shared/format'
import ReturnChecklist from './ReturnChecklist.vue'
import { Check, Clock } from '@lucide/vue'

const props = defineProps<{ loan: Loan; copyLabel: string }>()
const emit = defineEmits<{ close: []; changed: []; success: [] }>()
const clock = ref(Date.now())
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
const timer = setInterval(() => { clock.value = Date.now() }, 1000)
onBeforeUnmount(() => clearInterval(timer))
const incident = ref(false)
const description = ref('')
const sending = ref(false)
const checklistBusy = ref(false)
const missingParts = ref(props.loan.returnChecklist?.parts.some(part => !part.received) ?? false)
const checking = ref(false)
const unknown = ref(hasPendingReturn(props.loan.id))
const finished = ref(false)
const error = ref('')
const notice = ref('')
const busy = computed(() => sending.value || checking.value || checklistBusy.value)
async function confirm() {
  if (busy.value || unknown.value || finished.value) return
  error.value = ''
  let body
  try {
    const instant = Date.now()
    if (missingParts.value && (!incident.value || !description.value.trim()))
      throw new ApiError('Hay partes faltantes: registra una incidencia y describe lo ocurrido antes de devolver.', 400)
    body = returnInput(new Date(instant).toISOString(), incident.value, description.value, props.loan.startsAt, instant)
  } catch (cause) {
    error.value = errorMessage(cause)
    return
  }
  sending.value = true
  const owner = getSession()?.user.id ?? 'public'
  setPendingReturn(props.loan.id, true, owner)
  try {
    await returnLoan(props.loan.id, body)
    setPendingReturn(props.loan.id, false, owner)
    emit('success')
  } catch (cause) {
    const status = cause instanceof ApiError ? cause.status : undefined
    unknown.value = uncertainReturn(status)
    if (!unknown.value) setPendingReturn(props.loan.id, false, owner)
    error.value = unknown.value
      ? 'No se pudo confirmar el resultado. La devolución puede haberse registrado. Consulta el estado antes de volver a enviar.'
      : errorMessage(cause)
    if (status === 404 || status === 409) {
      // El dato de la lista ya no es fiable. Exige consultar antes de reintentar.
      unknown.value = true
      setPendingReturn(props.loan.id, true, owner)
      emit('changed')
    }
  } finally {
    sending.value = false
  }
}
async function check() {
  if (busy.value) return
  checking.value = true
  error.value = ''
  try {
    finished.value = await reconcileReturn(props.loan.id)
    unknown.value = !finished.value
    notice.value = finished.value
      ? 'El servidor informa que este préstamo ya está finalizado. No se enviará otra devolución.'
      : 'El servidor aún no confirma una devolución finalizada. Una lectura activa no prueba que el envío anterior haya fallado; el reenvío continúa bloqueado.'
    emit('changed')
  } catch (cause) {
    error.value = errorMessage(cause)
    if (cause instanceof ApiError && cause.status === 404) {
      notice.value = 'No se encontró una confirmación de devolución. Se mantiene el bloqueo hasta verificar que el préstamo ha finalizado.'
      emit('changed')
    }
  } finally {
    checking.value = false
  }
}
</script>
<template>
  <ModalDialog class="return-dialog" title="Registrar devolución" :subtitle="copyLabel" :busy="busy" @close="emit('close')">
    <div class="return-body">
    <ReturnChecklist
      :loan-id="loan.id"
      :copy-id="loan.copyId"
      :disabled="sending || checking || unknown || finished"
      @busy="checklistBusy = $event"
      @missing="missingParts = $event; if ($event) incident = true"
    />
    <form class="stack" @submit.prevent="confirm">
      <div class="return-timing" :class="{ late: clock > new Date(loan.endsAt).getTime() }"><Clock :size="18" aria-hidden="true" /><p>
        {{
          clock > new Date(loan.endsAt).getTime()
            ? 'devolución posterior al vencimiento'
            : 'devolución dentro del plazo'
        }}. Se capturará la hora exacta al confirmar; el servidor determina la puntualidad.
      </p></div>
      <details class="return-reference"><summary>Fechas y referencia del préstamo</summary><p>Límite: {{ dateTime(loan.endsAt) }}</p><p>Hora actual: {{ dateTime(new Date(clock).toISOString()) }} · {{ zone }}</p><p>Préstamo {{ loan.id }} · Usuario {{ loan.userId }}</p></details>
      <fieldset :disabled="busy || unknown || finished" class="stack return-condition">
        <legend>Condición del ejemplar</legend>
        <p v-if="missingParts" class="error" role="status">Hay partes faltantes. La devolución requiere una descripción de incidencia; no aplica sanción automática.</p>
        <label class="condition-option" :class="{ chosen: !incident }"
          ><input v-model="incident" name="return-condition" type="radio" :value="false" :disabled="missingParts" />
          Devolución sin incidencias</label
        >
        <label class="condition-option incident-option" :class="{ chosen: incident }"
          ><input v-model="incident" name="return-condition" type="radio" :value="true" />
          Incidencia que requiere revisión</label
        >
        <template v-if="incident"
          ><p class="error">
            Al registrar una incidencia el ejemplar quedará NO DISPONIBLE hasta su revisión. No se
            aplica una sanción automática.
          </p>
          <label
            >Descripción de la incidencia<textarea
              v-model="description"
              required
              maxlength="1000"
              rows="4"
            /></label
        ></template>
        <p v-else>El ejemplar volverá a estar disponible. No se enviará ninguna observación.</p>
      </fieldset>
      <p v-if="unknown" class="error" role="alert">
        Resultado pendiente de verificar. El envío está bloqueado.
      </p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="notice" class="notice" role="status">{{ notice }}</p>
      <div class="row return-actions">
        <button type="button" :disabled="busy" @click="emit('close')">Cerrar</button>
        <button v-if="unknown" type="button" :disabled="busy" @click="check">
          {{ checking ? 'Consultando…' : 'Consultar estado del préstamo' }}
        </button>
        <button
          v-if="!finished"
          class="primary"
          type="submit"
          :disabled="busy || unknown || (incident && !description.trim()) || (missingParts && (!incident || !description.trim()))"
        >
          <Check :size="16" aria-hidden="true" />{{ sending ? 'Registrando…' : 'Confirmar solo devolución básica' }}
        </button>
      </div>
    </form>
    </div>
  </ModalDialog>
</template>
<style scoped>
.application dialog.return-dialog { padding: 0; border-radius: 24px; max-width: min(512px,calc(100vw - 2rem)); }
.return-dialog :deep(.modal-heading) { background: #1e3a5f; color: white; padding: 24px 28px; margin: 0; border: 0; }
.return-dialog :deep(.modal-heading h2) { font-size: 22px; }
.return-dialog :deep(.modal-heading p) { color: #bfdbfe; line-height: 1.6; }
.application .return-dialog :deep(.modal-heading button) { color: white; }
.return-body { padding: 24px 28px; }
.return-timing { display: flex; align-items: start; gap: 10px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 14px; border-radius: 12px; }
.return-timing p { font-size: 12px; line-height: 1.7; }
.return-timing.late { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
.return-reference { font-size: 11px; color: #64748b; line-height: 1.8; }
.return-reference summary { cursor: pointer; }
.return-condition { border: 0; padding: 16px 0 0; border-top: 1px solid #e2e8f0; }
.return-condition legend { font-size: 14px; font-weight: 700; padding-right: 8px; }
.application .return-condition .condition-option { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; }
.application .return-condition input[type='radio'] { width: 16px; height: 16px; margin: 0; accent-color: #059669; flex-shrink: 0; }
.application .return-condition .chosen { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
.application .return-condition .incident-option.chosen { color: #991b1b; background: #fef2f2; border-color: #fecaca; }
.return-condition p, .return-condition label { font-size: 12px; line-height: 1.7; }
.application .return-actions { border-top: 1px solid #e2e8f0; padding-top: 20px; flex-wrap: wrap; align-items: stretch; }
.application .return-actions button { display: inline-flex; justify-content: center; align-items: center; gap: 6px; flex: 1; padding: 12px; border-radius: 12px; font-size: 12px; font-weight: 700; }
@media (max-width: 600px) {
 .application dialog.return-dialog { border-radius: 12px; }
 .return-dialog :deep(.modal-heading) { padding: 16px; }
 .return-dialog :deep(.modal-heading h2) { font-size: 18px; }
 .return-body { padding: 20px 16px; }
 .application .return-actions button { flex-basis: 100%; }
}
</style>
