<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Copy } from '../../inventory/api/inventory-api'
import { cancelReservation, createReservation, type Reservation } from '../api/reservations-api'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { errorMessage } from '../../../shared/composables/useRemote'
import { ApiError } from '../../../shared/api/client'
import { dateTime } from '../../../shared/format'
import AlertHint from '../../../shared/components/AlertHint.vue'
import { useRemote } from '../../../shared/composables/useRemote'
import { getReservationSettings } from '../../system/api/reservation-settings-api'
import { futurePreset, limaInstant, reservationTimeError } from '../../system/reservation-time'
const props = defineProps<{ copies: Copy[]; resourceName: string }>()
const emit = defineEmits<{ close: []; created: [] }>()
const copyId = ref(''),
  selectedDate = ref(futurePreset(Date.now(), 1).date),
  selectedTime = ref(futurePreset(Date.now(), 1).time),
  sending = ref(false),
  error = ref(''),
  uncertain = ref(false),
  result = ref<Reservation | null>(null)
const cancelling = ref(false), cancellationReason = ref(''), humanConfirmation = ref(false)
const settings = useRemote(getReservationSettings)
const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onBeforeUnmount(() => clearInterval(timer))
const validation = computed(() => settings.data.value
  ? reservationTimeError(selectedDate.value, selectedTime.value, settings.data.value, now.value) : '')
function preset(minutes: number) {
  const next = futurePreset(Date.now(), minutes)
  selectedDate.value = next.date
  selectedTime.value = next.time
  now.value = Date.now()
}
async function cancelConfirmed() {
  if (!result.value || result.value.status !== 'CONFIRMADA' || sending.value || uncertain.value || !humanConfirmation.value) return
  sending.value = true
  error.value = ''
  try {
    result.value = await cancelReservation(result.value.id, cancellationReason.value, result.value.userId)
    cancelling.value = false
    emit('created')
  } catch (cause) {
    error.value = errorMessage(cause)
    uncertain.value = cause instanceof ApiError && (cause.status === 0 || cause.status >= 500)
  } finally { sending.value = false }
}
async function submit() {
  now.value = Date.now()
  if (
    sending.value ||
    uncertain.value ||
    result.value ||
    !settings.data.value || settings.loading.value || validation.value ||
    !props.copies.some((c) => c.id === copyId.value && c.estado === 'DISPONIBLE')
  )
    return
  sending.value = true
  error.value = ''
  try {
    result.value = await createReservation(copyId.value, limaInstant(selectedDate.value, selectedTime.value)!)
    emit('created')
  } catch (cause) {
    error.value = errorMessage(cause)
    uncertain.value = cause instanceof ApiError && (cause.status === 0 || cause.status >= 500)
  } finally {
    sending.value = false
  }
}
</script>
<template>
  <ModalDialog title="Reservar ejemplar" :subtitle="resourceName" :busy="sending" mobile-sheet compact @close="emit('close')">
    <form class="stack reservation-form" @submit.prevent="submit">
      <template v-if="!result"
        ><label
          >Ejemplar disponible<select v-model="copyId" required :disabled="sending || uncertain">
            <option value="">Seleccionar ejemplar</option>
            <option
              v-for="copy in copies.filter((c) => c.estado === 'DISPONIBLE')"
              :key="copy.id"
              :value="copy.id"
            >
              {{ copy.codigoInventario }}
            </option>
          </select></label
        >
        <div class="reservation-time">
          <label>Fecha<input v-model="selectedDate" type="date" required :disabled="sending || uncertain" /></label>
          <label>Hora<input v-model="selectedTime" type="time" required :disabled="sending || uncertain" /></label>
        </div>
        <div class="row presets"><button v-for="option in [{ minutes: 1, label: 'En 1 minuto' }, { minutes: 10, label: 'En 10 minutos' }, { minutes: 60, label: 'En 1 hora' }]" :key="option.minutes" type="button" :disabled="sending || uncertain" @click="preset(option.minutes)">{{ option.label }}</button></div>
        <p>America/Lima<span v-if="settings.data.value"> · Espera {{ settings.data.value.pickupWaitMinutes }} min</span></p>
        <p v-if="settings.loading.value" role="status">Cargando horario…</p>
        <div v-if="settings.error.value" role="alert"><AlertHint :message="settings.error.value" label="Error al cargar horario" /> Configuración no disponible. <button type="button" @click="settings.refresh">Reintentar</button></div>
        <p v-if="settings.data.value?.scheduleStatus === 'UNCONFIGURED'"> <AlertHint :message="settings.data.value.warning || 'La disponibilidad por horario aún no está configurada.'" /> Horario sin configurar</p>
        <p v-if="validation" role="status"><AlertHint :message="validation" label="Revisar fecha y hora" /> {{ validation }}</p>
      </template>
      <p v-if="error" role="alert" class="error"><AlertHint :message="error" label="Detalle del error" /> No se pudo confirmar la operación.</p>
      <p v-if="uncertain" role="status" class="error">
        <AlertHint message="Resultado incierto. Cerrar no cancela la solicitud; usa el identificador disponible para consultar al personal." /> No repitas; consulta tus reservas. <RouterLink to="/app/history">Mis reservas</RouterLink>
      </p>
      <section v-if="result" class="notice" role="status">
        <h3>{{ result.status === 'CANCELADA' ? 'Cancelación confirmada' : 'Reserva confirmada' }}</h3>
        <p>
          ID (seleccionable): <code>{{ result.id }}</code>
        </p>
        <p>Recoger antes de {{ dateTime(result.pickupDeadline) }}</p>
        <p>Titular: {{ result.userId }} · Estado: {{ result.status }}</p>
        <button v-if="result.status === 'CONFIRMADA' && !cancelling" type="button" :disabled="sending || uncertain" @click="cancelling = true">Cancelar esta reserva</button>
      </section>
      <section v-if="cancelling && result?.status === 'CONFIRMADA'" class="panel stack">
        <h3>Confirmar cancelación de {{ result.id }}</h3>
        <label>Motivo opcional<textarea v-model="cancellationReason" maxlength="1000" :disabled="sending || uncertain" /></label>
        <label><input v-model="humanConfirmation" type="checkbox" :disabled="sending || uncertain" /> Confirmo que deseo cancelar esta reserva de mi cuenta.</label>
        <button type="button" :disabled="sending || uncertain || !humanConfirmation" @click="cancelConfirmed">Confirmar cancelación</button>
        <button type="button" :disabled="sending" @click="cancelling = false">Conservar reserva</button>
      </section>
      <div class="row reservation-actions">
        <button type="button" :disabled="sending" @click="emit('close')">Cerrar</button
        ><button
          v-if="!result"
          class="primary"
          :disabled="sending || uncertain || !copyId || !settings.data.value || settings.loading.value || !!validation"
        >
          Confirmar reserva</button
        ><RouterLink to="/app/terms">Mis términos</RouterLink>
      </div>
    </form>
  </ModalDialog>
</template>
<style scoped>
.reservation-form > label { color: #64748b; font-size: 12px; font-weight: 600; }
.reservation-time { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.reservation-time label { min-width: 0; }
.presets { flex-wrap: wrap; gap: 6px; }
.presets button { font-size: 12px; padding: 6px 10px; }
.reservation-form > p { font-size: 12px; line-height: 1.6; color: #64748b; }
.reservation-actions > button { flex: 1; padding-block: 10px; font-size: 14px; font-weight: 600; }
.reservation-actions > a { flex-basis: 100%; text-align: center; font-size: 12px; color: #2563eb; margin-top: 4px; }
</style>
