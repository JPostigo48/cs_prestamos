<script setup lang="ts">
import { ref } from 'vue'
import { getSession } from '../../auth/api/auth-api'
import {
  listReservations,
  cancelReservation,
  pickupReservation,
  type Reservation,
} from '../api/reservations-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { dateTime } from '../../../shared/format'
import { ApiError } from '../../../shared/api/client'
const props = defineProps<{ staff?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const session = getSession()!
const remote = useRemote(
  (signal) =>
    listReservations(props.staff ? { status: 'CONFIRMADA' } : { userId: session.user.id }, signal),
  () => true,
  false,
)
const selected = ref<Reservation | null>(null),
  reason = ref(''),
  sending = ref(false),
  error = ref(''),
  notice = ref(''),
  uncertain = ref(false)
function select(item: Reservation) {
  selected.value = item
  reason.value = ''
  error.value = ''
  uncertain.value = false
}
async function confirm() {
  if (!selected.value || sending.value || uncertain.value) return
  sending.value = true
  error.value = ''
  try {
    if (props.staff) {
      const loan = await pickupReservation(selected.value.id)
      notice.value = 'Entrega confirmada. Préstamo ' + loan.id
    } else {
      await cancelReservation(selected.value.id, reason.value)
      notice.value = 'Cancelación confirmada.'
    }
    selected.value = null
    emit('changed')
    await remote.refresh()
  } catch (cause) {
    error.value = errorMessage(cause)
    uncertain.value = cause instanceof ApiError && (cause.status === 0 || cause.status >= 500)
  } finally {
    sending.value = false
  }
}
</script>
<template>
  <section class="panel stack">
    <h2>{{ staff ? 'Entregas de reservas' : 'Mis reservas' }}</h2>
    <p>Listado F14 pendiente de backend. Un error no significa que no existan reservas.</p>
    <button :disabled="remote.loading.value" @click="remote.refresh">
      Consultar / actualizar reservas
    </button>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
    <RemoteState :loading="remote.loading.value" :error="remote.error.value" @retry="remote.refresh"
      ><template v-if="remote.data.value">
        <p>{{ remote.data.value.total }} reservas</p>
        <div class="cards">
          <article v-for="item in remote.data.value.items" :key="item.id" class="panel stack">
            <h3>Reserva {{ item.id }}</h3>
            <p>Ejemplar {{ item.copyId }} · {{ item.status }}</p>
            <p>
              Recogida: {{ dateTime(item.requestedAt) }} · límite
              {{ dateTime(item.pickupDeadline) }}
            </p>
            <p v-if="staff">Usuario {{ item.userId }}</p>
            <button
              v-if="item.status === 'CONFIRMADA' && (staff || item.userId === session.user.id)"
              @click="select(item)"
            >
              {{ staff ? 'Confirmar entrega' : 'Cancelar mi reserva' }}
            </button>
          </article>
        </div>
        <p v-if="!remote.data.value.items.length">No hay reservas en la respuesta recibida.</p>
      </template></RemoteState
    >
  </section>
  <ModalDialog
    v-if="selected"
    :title="staff ? 'Confirmar recogida' : 'Cancelar reserva propia'"
    :busy="sending"
    @close="selected = null"
    ><form class="stack" @submit.prevent="confirm">
      <p>Reserva {{ selected.id }} · ejemplar {{ selected.copyId }}</p>
      <label v-if="!staff">Motivo opcional<textarea v-model="reason" maxlength="500" /></label>
      <p v-else>Verifica la identidad del titular antes de entregar el ejemplar.</p>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="uncertain" class="error">
        Resultado incierto. Consulta reservas y préstamos antes de repetir.
      </p>
      <div class="row">
        <button type="button" :disabled="sending" @click="selected = null">Cerrar</button
        ><button :disabled="sending || uncertain">Confirmar</button>
      </div>
    </form></ModalDialog
  >
</template>
