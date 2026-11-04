<script lang="ts">
import type { Loan } from '../api/loans-api'

export type HistoryState = 'DEVUELTO' | 'VENCIDO' | 'ACTIVO' | 'PROGRAMADO'

export function historyState(loan: Pick<Loan, 'status' | 'endsAt'>, now: number = Date.now()): HistoryState {
  if (loan.status === 'FINALIZADO') return 'DEVUELTO'
  if (loan.status === 'PLANIFICADO') return 'PROGRAMADO'
  return Date.parse(loan.endsAt) < now ? 'VENCIDO' : 'ACTIVO'
}
</script>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { getSession } from '../../auth/api/auth-api'
import { getHistory } from '../../users/api/student-api'
import { useCopyDetails } from '../../inventory/useCopyDetails'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import ReservationsPanel from '../components/ReservationsPanel.vue'
import { dateTime } from '../../../shared/format'

const session = getSession()!
const loans = useRemote((signal) => getHistory(session.user.id, signal))
const copies = useCopyDetails(() => loans.data.value ?? [])

const filterOptions = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'ACTIVO', label: 'Activos' },
  { key: 'VENCIDO', label: 'Vencidos' },
  { key: 'DEVUELTO', label: 'Devueltos' },
  { key: 'PROGRAMADO', label: 'Programados' },
] as const
const filter = ref<HistoryState | 'TODOS'>('TODOS')
const stateLabel: Record<HistoryState, string> = { DEVUELTO: 'Devuelto', VENCIDO: 'Vencido', ACTIVO: 'Activo', PROGRAMADO: 'Programado' }
const stateTone: Record<HistoryState, 'neutral' | 'danger' | 'info' | 'success'> = { DEVUELTO: 'neutral', VENCIDO: 'danger', ACTIVO: 'info', PROGRAMADO: 'success' }

const filterCounts = computed(() => {
  const counts: Record<HistoryState | 'TODOS', number> = { TODOS: 0, DEVUELTO: 0, VENCIDO: 0, ACTIVO: 0, PROGRAMADO: 0 }
  for (const loan of loans.data.value ?? []) {
    counts.TODOS++
    counts[historyState(loan)]++
  }
  return counts
})
const visible = computed(() => {
  const items = (loans.data.value ?? [])
    .map((loan) => ({ loan, state: historyState(loan) }))
    .sort((a, b) => Date.parse(b.loan.startsAt) - Date.parse(a.loan.startsAt))
  return filter.value === 'TODOS' ? items : items.filter((item) => item.state === filter.value)
})
</script>
<template>
  <header class="history-heading">
    <h1>Mis reservas y préstamos</h1>
    <p class="muted">Consulta tus reservas y revisa tus préstamos, sus fechas y cada devolución.</p>
  </header>
  <ReservationsPanel />
  <section class="panel stack">
    <h2>Mi historial de préstamos</h2>
    <div class="row history-filters" role="group" aria-label="Filtrar por estado">
      <button
        v-for="option in filterOptions"
        :key="option.key"
        type="button"
        :class="{ primary: filter === option.key }"
        :aria-pressed="filter === option.key"
        @click="filter = option.key"
      >
        {{ option.label }} ({{ filterCounts[option.key] }})
      </button>
    </div>
    <RemoteState :loading="loans.loading.value" :error="loans.error.value" @retry="loans.refresh">
      <template v-if="loans.data.value">
        <p v-if="!loans.data.value.length">
          Aún no tienes préstamos. <RouterLink to="/app/catalog">Explora el catálogo</RouterLink> para solicitar uno.
        </p>
        <p v-else-if="!visible.length">No hay préstamos en este estado</p>
        <div v-else class="cards">
          <article v-for="{ loan, state } in visible" :key="loan.id" class="panel stack history-card">
            <div class="history-card-heading">
              <h2>{{ copies[loan.copyId]?.recurso.nombre || 'Recurso no disponible' }}</h2>
              <StatusBadge :tone="stateTone[state]">{{ stateLabel[state] }}</StatusBadge>
            </div>
            <dl class="history-dates">
              <div><dt>Préstamo</dt><dd>{{ dateTime(loan.startsAt) }}</dd></div>
              <div><dt>Fecha límite</dt><dd>{{ dateTime(loan.endsAt) }}</dd></div>
              <div v-if="loan.return"><dt>Devolución</dt><dd>{{ dateTime(loan.return.returnedAt) }}</dd></div>
            </dl>
          </article>
        </div>
      </template>
    </RemoteState>
  </section>
</template>
<style scoped>
.history-heading { margin-bottom: 24px; }
.history-heading p { font-size: 14px; margin-top: 8px; }
.history-filters button { font-size: 13px; }
.history-card-heading { display: flex; justify-content: space-between; align-items: start; gap: 10px; }
.history-card-heading h2 { font-size: 15px; margin: 0; }
.history-card-heading :deep(.status-badge) { flex-shrink: 0; }
.history-dates { margin: 0; }
.history-dates dt { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
.history-dates dd { margin: 2px 0 10px; font-size: 13px; }
</style>
