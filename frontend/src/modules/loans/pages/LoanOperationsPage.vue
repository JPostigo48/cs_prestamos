<script setup lang="ts">
import { computed, ref } from 'vue'
import { getActiveLoans, getOverdueLoans, type Loan } from '../api/loans-api'
import { Check, RefreshCw, ClipboardList, CalendarDays } from '@lucide/vue'
import { useCopyDetails } from '../../inventory/useCopyDetails'
import { useUserDetails } from '../../users/useUserDetails'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ReturnLoanDialog from '../components/ReturnLoanDialog.vue'
import ReservationsPanel from '../components/ReservationsPanel.vue'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import { dateTime } from '../../../shared/format'

const active = useRemote(getActiveLoans)
const overdue = useRemote(getOverdueLoans)
const tab = ref<'active' | 'overdue' | 'pickups'>('active')
const current = computed(() => (tab.value === 'active' ? active : overdue))
const selected = ref<Loan | null>(null)
function selectLoan(loan: Loan) {
  selected.value = loan
  notice.value = ''
}
const notice = ref('')
const copies = useCopyDetails(() => [...(active.data.value ?? []), ...(overdue.data.value ?? [])])
const users = useUserDetails(() => [...(active.data.value ?? []), ...(overdue.data.value ?? [])])
function refresh() {
  void active.refresh()
  void overdue.refresh()
}
function success() {
  selected.value = null
  notice.value = 'Devolución confirmada por el servidor.'
  refresh()
}
const date = dateTime
const isLate = (loan: Loan) => new Date(loan.endsAt).getTime() < Date.now()
const copyLabel = (loan: Loan) =>
  copies.value[loan.copyId]
    ? `${copies.value[loan.copyId]!.recurso.nombre} · ${copies.value[loan.copyId]!.codigoInventario}`
    : `Ejemplar ${loan.copyId}`
</script>
<template>
  <section class="operator-page">
  <header class="operator-heading">
    <div><h1>Panel del Operador</h1><p class="muted">Administra reservas, recibe equipos y revisa solicitudes.</p></div>
    <button class="refresh-lists" aria-label="Actualizar listas" :disabled="active.loading.value || overdue.loading.value" @click="refresh"><RefreshCw :size="16" aria-hidden="true" /><span>Actualizar listas</span></button>
  </header>
  <p v-if="notice" class="notice" role="status">{{ notice }}</p>
  <div class="operator-tabs" role="group" aria-label="Tipo de préstamos">
    <button :aria-pressed="tab === 'active'" @click="tab = 'active'">
      Activos · {{ active.data.value?.length ?? '—' }}</button
    ><button class="overdue-tab" :aria-pressed="tab === 'overdue'" @click="tab = 'overdue'">
      En mora · {{ overdue.data.value?.length ?? '—' }}</button
    ><button :aria-pressed="tab === 'pickups'" @click="tab = 'pickups'"><CalendarDays :size="16" aria-hidden="true" />Entregas de reservas</button>
    <RouterLink to="/app/registrations"><ClipboardList :size="16" aria-hidden="true" />Solicitudes</RouterLink>
  </div>
  <div v-show="tab === 'pickups'" data-reservations-panel>
    <ReservationsPanel staff @changed="refresh" />
  </div>
  <p v-if="tab !== 'pickups' && (tab === 'active' ? overdue.error.value : active.error.value)" class="error" role="alert">
    La otra lista no pudo cargarse. Selecciónala para consultar el error y reintentar.
  </p>
  <RemoteState
    v-if="tab !== 'pickups'"
    :loading="current.loading.value"
    :error="current.error.value"
    @retry="current.refresh"
  >
    <p v-if="current.data.value?.length === 0" class="panel operator-empty">
      No hay préstamos {{ tab === 'active' ? 'activos' : 'vencidos' }}.
    </p>
    <div class="operator-loans">
      <article v-for="loan in current.data.value" :key="loan.id" class="panel loan-card" :class="{ overdue: isLate(loan) }">
        <div class="loan-card-heading"><h2>{{ users[loan.userId]?.name || 'Usuario ' + loan.userId }}</h2><StatusBadge :tone="isLate(loan) ? 'danger' : 'info'">{{ isLate(loan) ? 'En mora' : loan.status.replaceAll('_', ' ') }}</StatusBadge></div>
        <div class="loan-resource-summary"><p class="loan-resource">{{ copies[loan.copyId]?.recurso.nombre || 'Ejemplar ' + loan.copyId }}</p>
        <p class="loan-code">{{ copies[loan.copyId]?.codigoInventario || loan.copyId }}</p></div>
        <dl class="loan-deadline"><dt>Límite</dt><dd>{{ date(loan.endsAt) }}</dd></dl>
        <details class="loan-details"><summary>Detalles del préstamo</summary><p>Inicio: {{ date(loan.startsAt) }}</p><p>Referencia: {{ loan.id }}</p>
        <RouterLink
          v-if="copies[loan.copyId]"
          :to="'/app/catalog/' + copies[loan.copyId]!.recurso.id"
          >Ver recurso y disponibilidad</RouterLink
        >
        </details>
          <button
            class="receive-loan"
            @click="selectLoan(loan)"
          >
            <Check :size="16" aria-hidden="true" />Registrar devolución
          </button>
      </article>
    </div>
  </RemoteState>
  <ReturnLoanDialog
    v-if="selected"
    :loan="selected"
    :copy-label="copyLabel(selected)"
    @close="selected = null"
    @changed="refresh"
    @success="success"
  />
  </section>
</template>
<style scoped>
.operator-heading { display: flex; align-items: start; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
.application .operator-heading h1 { margin-bottom: 8px; letter-spacing: -.025em; }
.operator-heading p { font-size: 14px; }
.application .refresh-lists { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; font-weight: 600; flex-shrink: 0; }
.operator-tabs { display: flex; gap: 8px; overflow-x: auto; max-width: 100%; border-bottom: 1px solid #e2e8f0; margin-bottom: 28px; padding: 0 0 1px; }
.application .operator-tabs :is(button,a) { display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: #64748b; padding: 16px 24px; font-size: 14px; font-weight: 700; text-decoration: none; white-space: nowrap; }
.application .operator-tabs [aria-pressed='true'] { border-color: #1e3a5f; color: #1e3a5f; }
.application .operator-tabs .overdue-tab[aria-pressed='true'] { color: #dc2626; border-color: #dc2626; }
.application .operator-tabs :is(button,a):hover { background: #f1f5f9; }
.operator-loans { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 24px; }
.application .loan-card { padding: 28px; border-radius: 16px; margin: 0; display: flex; flex-direction: column; min-width: 0; box-shadow: 0 1px 2px #0f172a0d; }
.application .loan-card.overdue { border-color: #fca5a5; background: #fef2f24d; }
.loan-card-heading { display: flex; justify-content: space-between; align-items: start; gap: 10px; margin-bottom: 16px; }
.application .loan-card-heading h2 { font-size: 20px; line-height: 1.4; margin: 0; }
.loan-card-heading :deep(.status-badge) { flex-shrink: 0; font-size: 10px; border-radius: 6px; padding: 3px 7px; }
.loan-resource { font-size: 16px; font-weight: 700; color: #1e293b; }
.loan-code { font: 13px/1.6 ui-monospace,monospace; color: #64748b; margin: 4px 0 16px; }
.loan-deadline { border: 1px solid #e2e8f0; border-radius: 8px; background: white; padding: 8px 12px; font-size: 13px; }
.loan-deadline dt { font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; }
.loan-deadline dd { font-weight: 700; line-height: 1.6; }
.overdue .loan-deadline { border-color: #fecaca; color: #dc2626; }
.loan-details { font-size: 12px; color: #64748b; line-height: 1.8; margin: 16px 0 20px; }
.loan-details summary { cursor: pointer; }
.application .receive-loan { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 12px; width: 100%; margin-top: auto; font-size: 13px; font-weight: 700; border-radius: 12px; border-color: #a7f3d0; color: #047857; background: #ecfdf5; }
.application .receive-loan:hover { background: #d1fae5; }
.application .overdue .receive-loan { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
.application .overdue .receive-loan:hover { background: #fee2e2; }
.operator-empty { padding: 48px; text-align: center; color: #64748b; }
@media (max-width: 1279px) { .operator-loans { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 639px) {
 .operator-heading { display: block; position: relative; margin-bottom: 20px; }
 .application .operator-heading h1 { padding-right: 42px; }
 .application .refresh-lists { position: absolute; top: 0; right: 0; width: 36px; height: 36px; padding: 8px; }
 .refresh-lists span { display: none; }
 .application .operator-tabs :is(button,a) { border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px 14px; font-size: 12px; background: white; }
 .application .operator-tabs [aria-pressed='true'] { background: #1e3a5f; color: white; }
 .application .operator-tabs .overdue-tab[aria-pressed='true'] { background: #fef2f2; }
 .operator-tabs { padding-bottom: 12px; margin-bottom: 16px; }
 .operator-loans { grid-template-columns: minmax(0,1fr); gap: 12px; }
 .application .loan-card { padding: 16px; border-radius: 12px; }
 .application .loan-card-heading h2 { font-size: 14px; }
 .loan-card-heading { margin-bottom: 8px; }
 .loan-resource-summary { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 6px; margin-bottom: 6px; }
 .loan-resource { font-size: 12px; font-weight: 500; color: #475569; }
 .loan-code { margin: 0; font-size: 11px; }
 .loan-deadline { padding: 0; border: 0; background: transparent; border-radius: 0; font-size: 11px; }
 .loan-deadline :is(dt,dd) { display: inline; font-size: 11px; font-weight: 500; }
 .loan-deadline dt::after { content: ': '; }
 .loan-details { font-size: 11px; margin: 8px 0 12px; }
 .application .receive-loan { padding: 10px; }
}
</style>
