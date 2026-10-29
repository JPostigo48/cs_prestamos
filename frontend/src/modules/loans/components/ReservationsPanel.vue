<script setup lang="ts">
import { ref } from 'vue'
import { getSession } from '../../auth/api/auth-api'
import { isStaff } from '../../auth/access-policy'
import {
  listReservations,
  cancelReservation,
  pickupReservation,
  type Reservation,
} from '../api/reservations-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import { useCopyDetails } from '../../inventory/useCopyDetails'
import { useUserDetails } from '../../users/useUserDetails'
import { dateTime } from '../../../shared/format'
import { ApiError } from '../../../shared/api/client'
const props = defineProps<{ staff?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const session = getSession()!
const page = ref(1)
const remote = useRemote(
  (signal) =>
    listReservations({ ...(props.staff && isStaff(session.user.role) ? { status: 'CONFIRMADA' } : { userId: session.user.id }), page: String(page.value), limit: '20' }, signal),
  () => true,
  false,
)
function move(offset: number) { page.value += offset; void remote.refresh() }
const copies = useCopyDetails(() => remote.data.value?.items ?? null)
const users = useUserDetails(() => props.staff ? remote.data.value?.items ?? null : null)
const selected = ref<Reservation | null>(null),
  reason = ref(''),
  sending = ref(false),
  error = ref(''),
  notice = ref(''),
  uncertain = ref(false)
function select(item: Reservation) {
  if (props.staff && !isStaff(session.user.role)) return
  selected.value = item
  reason.value = ''
  error.value = ''
  uncertain.value = false
}
async function confirm() {
  if (!selected.value || sending.value || uncertain.value) return
  if (props.staff && !isStaff(session.user.role)) return
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
  <section class="panel stack reservations-panel" :class="{ 'staff-reservations': staff }">
    <h2>{{ staff ? 'Entregas de reservas' : 'Mis reservas' }}</h2>
    <p class="muted">{{ staff ? 'Verifica las reservas confirmadas y la identidad del titular antes de entregar un equipo.' : 'Consulta tus reservas y su hora límite de recogida. Si la consulta falla, no podremos confirmar su estado.' }}</p>
    <button :disabled="remote.loading.value" @click="remote.refresh">
      Consultar / actualizar reservas
    </button>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
    <RemoteState :loading="remote.loading.value" :error="remote.error.value" @retry="remote.refresh"
      ><template v-if="remote.data.value">
        <p>{{ remote.data.value.total }} reservas</p>
        <div class="cards">
          <article v-for="item in remote.data.value.items" :key="item.id" class="panel stack reservation-card">
            <h3 v-if="staff">{{ users[item.userId]?.name || 'Titular · ' + item.userId }}</h3>
            <h3 v-else><RouterLink v-if="copies[item.copyId]" :to="'/app/catalog/' + copies[item.copyId]!.recurso.id">{{ copies[item.copyId]!.recurso.nombre }}</RouterLink><span v-else>Reserva de recurso</span></h3>
            <StatusBadge :tone="item.status === 'CONFIRMADA' ? 'info' : 'neutral'">{{ item.status.replaceAll('_', ' ') }}</StatusBadge>
            <p v-if="staff" class="reservation-resource"><RouterLink v-if="copies[item.copyId]" :to="'/app/catalog/' + copies[item.copyId]!.recurso.id">{{ copies[item.copyId]!.recurso.nombre }}</RouterLink><span v-else>Reserva de recurso</span></p>
            <p class="muted">Ejemplar {{ copies[item.copyId]?.codigoInventario || item.copyId }}</p>
            <dl class="reservation-dates"><div><dt>Hora de recogida</dt><dd>{{ dateTime(item.requestedAt) }}</dd></div><div><dt>Límite de recogida</dt><dd>{{ dateTime(item.pickupDeadline) }}</dd></div></dl>
            <details class="muted"><summary>Referencia de reserva</summary><p>Reserva {{ item.id }}</p><p v-if="staff">Titular · {{ item.userId }}</p></details>
            <button
              :class="{ primary: staff }"
              v-if="item.status === 'CONFIRMADA' && (staff || item.userId === session.user.id)"
              @click="select(item)"
            >
              {{ staff ? 'Confirmar entrega' : 'Cancelar mi reserva' }}
            </button>
          </article>
        </div>
        <p v-if="!remote.data.value.items.length">No hay reservas en la respuesta recibida.</p>
        <nav class="row" aria-label="Páginas de reservas">
          <button :disabled="remote.loading.value || page <= 1" @click="move(-1)">Anterior</button>
          <span>Página {{ remote.data.value.page }}</span>
          <button :disabled="remote.loading.value || page * remote.data.value.limit >= remote.data.value.total" @click="move(1)">Siguiente</button>
        </nav>
      </template></RemoteState
    >
  </section>
  <ModalDialog
    v-if="selected"
    :title="staff ? 'Confirmar recogida' : 'Cancelar reserva propia'"
    :subtitle="copies[selected.copyId]?.recurso.nombre"
    compact
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
        ><button class="primary" :disabled="sending || uncertain">{{ sending ? 'Procesando…' : 'Confirmar' }}</button>
      </div>
    </form></ModalDialog
  >
</template>
<style scoped>
.reservations-panel > p { font-size: 14px; }
.reservation-card h3 { font-size: 14px; font-weight: 700; }
.reservation-card h3 a { color: #0f172a; text-decoration: none; }
.reservation-card > p, .reservation-card details { font-size: 12px; }
.reservation-card button { font-size: 13px; }
.reservation-dates { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 12px; border-top: 1px solid #f1f5f9; padding-top: 12px; }
.reservation-dates dt { font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px; }
.reservation-dates dd { font-size: 13px; line-height: 1.6; }
.application .staff-reservations { border: 0; padding: 0; background: transparent; }
.staff-reservations :deep(.cards) { grid-template-columns: minmax(0,1fr); gap: 12px; }
.application .staff-reservations .reservation-card { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px 24px; padding: 20px; border-radius: 12px; margin: 0; box-shadow: 0 1px 2px #0f172a0d; }
.staff-reservations .reservation-card > * { margin: 0; }
.staff-reservations .reservation-card h3 { grid-column: 1; font-size: 14px; }
.staff-reservations .reservation-card > .status-badge { grid-column: 2; grid-row: 1; justify-self: end; }
.staff-reservations .reservation-card > .muted { grid-column: 1; }
.staff-reservations .reservation-dates { grid-column: 1; border: 0; padding-top: 0; }
.staff-reservations .reservation-card > details { grid-column: 1; }
.staff-reservations .reservation-resource { grid-column: 1; font-size: 13px; color: #475569; }
.application .staff-reservations .reservation-resource a { text-decoration: none; }
.staff-reservations .reservation-card > button { grid-column: 2; grid-row: 2 / span 4; align-self: center; font-weight: 700; }
@media (max-width: 639px) {
 .application .staff-reservations .reservation-card { padding: 16px; gap: 10px; }
 .staff-reservations .reservation-card > button { grid-column: 1 / -1; grid-row: auto; width: 100%; }
 .staff-reservations .reservation-dates { grid-column: 1 / -1; }
}
</style>
