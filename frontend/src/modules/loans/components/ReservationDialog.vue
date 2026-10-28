<script setup lang="ts">
import { ref } from 'vue'
import type { Copy } from '../../inventory/api/inventory-api'
import { cancelReservation, createReservation, type Reservation } from '../api/reservations-api'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { errorMessage } from '../../../shared/composables/useRemote'
import { ApiError } from '../../../shared/api/client'
import { dateTime } from '../../../shared/format'
const props = defineProps<{ copies: Copy[]; resourceName: string }>()
const emit = defineEmits<{ close: []; created: [] }>()
const copyId = ref(''),
  requestedAt = ref(''),
  sending = ref(false),
  error = ref(''),
  uncertain = ref(false),
  result = ref<Reservation | null>(null)
const cancelling = ref(false), cancellationReason = ref(''), humanConfirmation = ref(false)
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
  if (
    sending.value ||
    uncertain.value ||
    result.value ||
    !props.copies.some((c) => c.id === copyId.value && c.estado === 'DISPONIBLE')
  )
    return
  sending.value = true
  error.value = ''
  try {
    result.value = await createReservation(copyId.value, requestedAt.value)
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
  <ModalDialog title="Reservar equipo" :busy="sending" @close="emit('close')">
    <form class="stack" @submit.prevent="submit">
      <p>{{ resourceName }}</p>
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
        <label
          >Hora futura de recogida (hora local del dispositivo)<input
            v-model="requestedAt"
            type="datetime-local"
            required
            :disabled="sending || uncertain"
        /></label>
        <p>
          El servidor validará términos, cupo y habilitación. La ventana de recogida confirmada se
          mostrará tras reservar.
        </p>
      </template>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="uncertain" class="error">
        Resultado incierto. No repitas la operación sin verificarla con personal usando el ID si está disponible. La consulta F14 puede no estar implementada; cerrar no confirma un fallo.
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
      <div class="row">
        <button type="button" :disabled="sending" @click="emit('close')">Cerrar</button
        ><button
          v-if="!result"
          class="primary"
          :disabled="sending || uncertain || !copyId || !requestedAt"
        >
          Confirmar reserva</button
        ><RouterLink to="/app/reservations">Mis reservas y términos</RouterLink>
      </div>
    </form>
  </ModalDialog>
</template>
