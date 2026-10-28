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
      notice.value = 'Un 404 no confirma una devolución. Se mantiene el bloqueo hasta obtener un estado finalizado válido.'
      emit('changed')
    }
  } finally {
    checking.value = false
  }
}
</script>
<template>
  <ModalDialog title="Registrar devolución" :busy="busy" @close="emit('close')">
    <ReturnChecklist
      :loan-id="loan.id"
      :copy-id="loan.copyId"
      :disabled="sending || checking || unknown || finished"
      @busy="checklistBusy = $event"
    />
    <form class="stack" @submit.prevent="confirm">
      <p>{{ copyLabel }}</p>
      <p class="muted">Préstamo {{ loan.id }} · Usuario {{ loan.userId }}</p>
      <p>
        Según el reloj actual ({{ zone }}):
        {{
          clock > new Date(loan.endsAt).getTime()
            ? 'devolución posterior al vencimiento'
            : 'devolución dentro del plazo'
        }}. Se capturará la hora exacta al confirmar; el servidor determina la puntualidad.
      </p>
      <fieldset :disabled="busy || unknown || finished" class="stack">
        <legend>Condición del ejemplar</legend>
        <p>Hora actual: {{ dateTime(new Date(clock).toISOString()) }} · {{ zone }}</p>
        <label
          ><input v-model="incident" name="return-condition" type="radio" :value="false" />
          Devolución sin incidencias</label
        >
        <label
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
      <div class="row">
        <button type="button" :disabled="busy" @click="emit('close')">Cerrar</button>
        <button v-if="unknown" type="button" :disabled="busy" @click="check">
          {{ checking ? 'Consultando…' : 'Consultar estado del préstamo' }}
        </button>
        <button
          v-if="!finished"
          type="submit"
          :disabled="busy || unknown || (incident && !description.trim())"
        >
          {{ sending ? 'Registrando…' : 'Confirmar solo devolución básica' }}
        </button>
      </div>
    </form>
  </ModalDialog>
</template>
