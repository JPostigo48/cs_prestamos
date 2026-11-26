<script lang="ts">
export { historyState, type HistoryState } from '../personal-history'
</script>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalendarClock, BookOpen, Clock, CircleCheck, TriangleAlert } from '@lucide/vue'
import { getSession } from '../../auth/api/auth-api'
import { getHistory } from '../../users/api/student-api'
import { parseLoans } from '../api/loan-contracts'
import ClosureHistoryNotice from '../components/ClosureHistoryNotice.vue'
import { cancelReservation, type Reservation } from '../api/reservations-api'
import { combineHistory, getPersonalReservations, type OperationState } from '../personal-history'
import { pendingMutation } from '../../../shared/api/mutation-guard'
import { useCopyDetails } from '../../inventory/useCopyDetails'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import { dateTime } from '../../../shared/format'
import { inventoryActionAllowed, inventoryCompatibilityMessage } from '../../inventory/api/compatibility-contracts'

const session = getSession()!
const loans = useRemote(async signal => parseLoans(await getHistory(session.user.id, signal)))
const reservations = useRemote(signal => getPersonalReservations(session.user.id, signal))
const operations = computed(() => combineHistory(loans.data.value ?? [], reservations.data.value ?? []))
const copies = useCopyDetails(() => operations.value)
const filter = ref('TODOS')
const filters = [
  { key: 'TODOS', label: 'Todo el historial', states: [] },
  { key: 'PENDIENTES', label: 'Por recoger', states: ['POR_RECOGER'] },
  { key: 'CURSO', label: 'En préstamo', states: ['ACTIVO', 'PROGRAMADO'] },
  { key: 'VENCIDOS', label: 'Vencidos', states: ['VENCIDO', 'RESERVA_VENCIDA'] },
  { key: 'CERRADOS', label: 'Finalizados', states: ['DEVUELTO', 'CERRADO_POR_INCIDENCIA', 'CANCELADA', 'CONVERTIDA'] },
]
const matches = (state: OperationState, key: string) => key === 'TODOS' || !!filters.find(f => f.key === key)?.states.includes(state)
const visible = computed(() => operations.value.filter(item => matches(item.state, filter.value)))
const labels: Record<OperationState, string> = {
  CERRADO_POR_INCIDENCIA: 'Préstamo cerrado por incidencia · no devuelto',
  POR_RECOGER: 'Reserva · pendiente de recogida', RESERVA_VENCIDA: 'Reserva · vencida sin recoger',
  CANCELADA: 'Reserva cancelada', CONVERTIDA: 'Reserva convertida a préstamo',
  ACTIVO: 'Préstamo activo', VENCIDO: 'Préstamo vencido', DEVUELTO: 'Préstamo devuelto', PROGRAMADO: 'Préstamo programado',
}
const selected = ref<Reservation | null>(null), reason = ref(''), sending = ref(false), error = ref(''), notice = ref('')
function select(item: Reservation) { selected.value = item; reason.value = ''; error.value = '' }
async function cancel() {
  const item = selected.value
  if (!item || sending.value || pendingMutation('cancel:' + item.id)) return
  if (!inventoryActionAllowed(copies.value[item.copyId]?.compatibility, 'release')) return
  sending.value = true
  error.value = ''
  try {
    await cancelReservation(item.id, reason.value, session.user.id)
    selected.value = null
    notice.value = 'Reserva cancelada.'
    await Promise.all([reservations.refresh(), loans.refresh()])
  } catch (cause) { error.value = errorMessage(cause) }
  finally { sending.value = false }
}
</script>
<template>
  <header class="history-heading"><h1>Mis reservas y préstamos</h1><p class="muted">De la reserva a la devolución, en un solo historial.</p></header>
  <section class="panel stack">
    <div class="row history-filters" role="group" aria-label="Filtrar historial">
      <button v-for="option in filters" :key="option.key" type="button" :class="{ primary: filter === option.key }" :aria-pressed="filter === option.key" @click="filter = option.key">
        {{ option.label }} ({{ operations.filter(item => matches(item.state, option.key)).length }})
      </button>
    </div>
    <div aria-label="Carga de reservas"><RemoteState :loading="reservations.loading.value" :error="reservations.error.value" @retry="reservations.refresh" /></div>
    <div aria-label="Carga de préstamos"><RemoteState :loading="loans.loading.value" :error="loans.error.value" @retry="loans.refresh" /></div>
    <p v-if="reservations.error.value || loans.error.value || reservations.loading.value || loans.loading.value" class="muted">El historial y los contadores estarán completos cuando terminen ambas consultas.</p>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
    <p v-if="reservations.data.value && loans.data.value && !operations.length">Aún no tienes reservas ni préstamos. <RouterLink to="/app/catalog">Explora el catálogo</RouterLink>.</p>
    <p v-else-if="reservations.data.value && loans.data.value && !visible.length">No hay operaciones en este estado.</p>
    <div class="history-list">
      <article v-for="item in visible" :key="item.key" class="operation-card">
        <component :is="item.state === 'DEVUELTO' ? CircleCheck : item.state.includes('VENCID') ? TriangleAlert : item.loan ? BookOpen : CalendarClock" :size="22" aria-hidden="true" class="operation-icon" />
        <div class="operation-content">
          <div class="operation-heading"><h2><RouterLink v-if="copies[item.copyId]" :to="'/app/catalog/' + copies[item.copyId]!.recurso.id">{{ copies[item.copyId]!.recurso.nombre }}</RouterLink><span v-else>Recurso de {{ item.loan ? 'préstamo' : 'reserva' }}</span></h2>
            <StatusBadge :tone="item.state.includes('VENCID') ? 'danger' : item.state === 'DEVUELTO' ? 'success' : 'info'">{{ labels[item.state] }}</StatusBadge>
          </div>
          <p v-if="item.loan && item.reservation" class="muted">Originado en tu reserva · recogida <time :datetime="item.reservation.pickedUpAt || item.loan.startsAt">{{ dateTime(item.reservation.pickedUpAt || item.loan.startsAt) }}</time></p>
          <p v-else-if="item.loan" class="muted">Préstamo · sin reserva vinculada{{ reservations.data.value ? '' : ' en los datos disponibles' }}</p>
          <p class="operation-date"><Clock :size="14" aria-hidden="true" /> {{ item.dateLabel }} <time :datetime="item.relevantAt">{{ dateTime(item.relevantAt) }}</time></p>
          <ClosureHistoryNotice v-if="item.loan" :loan="item.loan" />
          <p v-if="item.state === 'CERRADO_POR_INCIDENCIA'">{{ item.loan?.closure?.reason === 'ROBO' ? 'Robo' : item.loan?.closure?.reason === 'PERDIDA' ? 'Pérdida' : 'Pérdida o robo' }}: cierre sin devolución real.</p>
          <p v-if="item.state === 'POR_RECOGER'">Recoge antes del <time :datetime="item.reservation!.pickupDeadline">{{ dateTime(item.reservation!.pickupDeadline) }}</time>.</p>
          <p v-if="item.loan && ['ACTIVO', 'VENCIDO', 'PROGRAMADO'].includes(item.state)">{{ item.state === 'VENCIDO' ? 'Devuelve el recurso cuanto antes. Fecha límite:' : 'Devolución límite:' }} <time :datetime="item.loan.endsAt">{{ dateTime(item.loan.endsAt) }}</time></p>
          <p v-if="item.state === 'RESERVA_VENCIDA'" class="muted">El plazo de recogida terminó. <RouterLink to="/app/personal">Ver mi confianza y sanciones</RouterLink>.</p>
          <details v-if="item.reservation?.cancellationReason"><summary>Motivo de cancelación</summary><p>{{ item.reservation.cancellationReason }}</p></details>
          <p v-if="item.state === 'POR_RECOGER' && inventoryCompatibilityMessage(copies[item.copyId]?.compatibility)" role="status">{{ inventoryCompatibilityMessage(copies[item.copyId]?.compatibility) }}</p>
          <button v-if="item.state === 'POR_RECOGER' && item.reservation?.userId === session.user.id" :disabled="pendingMutation('cancel:' + item.reservation.id) || !inventoryActionAllowed(copies[item.copyId]?.compatibility, 'release')" @click="select(item.reservation)">Cancelar reserva</button>
          <p v-if="item.reservation && pendingMutation('cancel:' + item.reservation.id)" role="status">Cancelación pendiente de verificar. No se reenviará; consulta con el personal.</p>
        </div>
      </article>
    </div>
  </section>
  <ModalDialog v-if="selected" title="Cancelar reserva" :subtitle="copies[selected.copyId]?.recurso.nombre" compact :busy="sending" @close="selected = null">
    <form class="stack" @submit.prevent="cancel"><p>Se liberará tu reserva de este recurso.</p><label>Motivo opcional<textarea v-model="reason" maxlength="500" /></label>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="pendingMutation('cancel:' + selected.id) && !sending" role="status">Resultado incierto. No repitas el envío; verifica el estado con el personal.</p>
      <div class="row"><button type="button" :disabled="sending" @click="selected = null">Cerrar</button><button class="primary" :disabled="sending || pendingMutation('cancel:' + selected.id) || !inventoryActionAllowed(copies[selected.copyId]?.compatibility, 'release')">{{ sending ? 'Cancelando…' : 'Confirmar cancelación' }}</button></div>
    </form>
  </ModalDialog>
</template>
<style scoped>
.history-heading { margin-bottom: 24px; }
.history-heading p { font-size: 14px; margin-top: 8px; }
.history-filters { flex-wrap: wrap; }
.history-filters button { font-size: 13px; }
.history-list { display: grid; gap: 12px; }
.operation-card { display: flex; gap: 14px; padding: 18px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; }
.operation-icon { flex-shrink: 0; color: #1e40af; margin-top: 2px; }
.operation-content { min-width: 0; flex: 1; overflow-wrap: anywhere; font-size: 13px; }
.operation-content > * + * { margin-top: 8px; }
.operation-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; align-items: start; }
.operation-heading h2 { font-size: 15px; margin: 0; }
.operation-heading a { color: #1e3a5f; text-decoration: none; }
.operation-date { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; color: #475569; }
summary { cursor: pointer; color: #475569; }
@media (max-width: 639px) { .operation-card { padding: 12px; gap: 10px; } .operation-heading { flex-direction: column; } }
</style>
