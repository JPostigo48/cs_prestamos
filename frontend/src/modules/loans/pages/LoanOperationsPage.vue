<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getActiveLoans, getOverdueLoans, type Loan } from '../api/loans-api'
import { getCopy, type CopyDetail } from '../../inventory/api/inventory-api'
import { getUser, type UserProfile } from '../../users/api/student-api'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ReturnLoanDialog from '../components/ReturnLoanDialog.vue'
import ReservationsPanel from '../components/ReservationsPanel.vue'
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
const copies = ref<Record<string, CopyDetail>>({})
const users = ref<Record<string, UserProfile>>({})
const copyRequests = new Map<string, Promise<CopyDetail>>()
const userRequests = new Map<string, Promise<UserProfile>>()
const controller = new AbortController()
watch([active.data, overdue.data], ([a, b]) => {
  for (const loan of [...(a ?? []), ...(b ?? [])]) {
    if (!copyRequests.has(loan.copyId)) {
      const request = getCopy(loan.copyId, controller.signal)
      copyRequests.set(loan.copyId, request)
      void request
        .then((copy) => {
          copies.value[loan.copyId] = copy
        })
        .catch(() => {
          copyRequests.delete(loan.copyId)
        })
    }
    if (!userRequests.has(loan.userId)) {
      const request = getUser(loan.userId, controller.signal)
      userRequests.set(loan.userId, request)
      void request
        .then((user) => {
          users.value[loan.userId] = user
        })
        .catch(() => {
          userRequests.delete(loan.userId)
        })
    }
  }
})
onBeforeUnmount(() => controller.abort())
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
const copyLabel = (loan: Loan) =>
  copies.value[loan.copyId]
    ? `${copies.value[loan.copyId]!.recurso.nombre} · ${copies.value[loan.copyId]!.codigoInventario}`
    : `Ejemplar ${loan.copyId}`
</script>
<template>
  <h1>Préstamos y devoluciones</h1>
  <p class="muted">Panel operativo para operadores y administradores.</p>
  <p v-if="notice" class="notice" role="status">{{ notice }}</p>
  <div class="row panel" role="group" aria-label="Tipo de préstamos">
    <button :aria-pressed="tab === 'active'" @click="tab = 'active'">
      Activos · {{ active.data.value?.length ?? '—' }}</button
    ><button :aria-pressed="tab === 'overdue'" @click="tab = 'overdue'">
      En mora · {{ overdue.data.value?.length ?? '—' }}</button
    ><button :aria-pressed="tab === 'pickups'" @click="tab = 'pickups'">Entregas de reservas</button
    ><button :disabled="active.loading.value || overdue.loading.value" @click="refresh">
      Actualizar listas
    </button>
  </div>
  <div v-show="tab === 'pickups'" data-reservations-panel>
    <ReservationsPanel staff @changed="refresh" />
  </div>
  <p v-if="tab === 'active' ? overdue.error.value : active.error.value" class="error" role="alert">
    La otra lista no pudo cargarse. Selecciónala para consultar el error y reintentar.
  </p>
  <RemoteState
    v-if="tab !== 'pickups'"
    :loading="current.loading.value"
    :error="current.error.value"
    @retry="current.refresh"
  >
    <p v-if="current.data.value?.length === 0" class="panel">
      No hay préstamos {{ tab === 'active' ? 'activos' : 'vencidos' }}.
    </p>
    <div class="cards">
      <article v-for="loan in current.data.value" :key="loan.id" class="panel stack">
        <h2>{{ copyLabel(loan) }}</h2>
        <p>Usuario: {{ users[loan.userId]?.name || loan.userId }}</p>
        <p>Inicio: {{ date(loan.startsAt) }}</p>
        <p>Fecha límite: {{ date(loan.endsAt) }}</p>
        <p>
          {{ loan.status }}
          <strong v-if="new Date(loan.endsAt).getTime() < Date.now()">· Vencido</strong>
        </p>
        <RouterLink
          v-if="copies[loan.copyId]"
          :to="'/app/catalog/' + copies[loan.copyId]!.recurso.id"
          >Ver recurso y disponibilidad</RouterLink
        >
        <div>
          <button
            @click="selectLoan(loan)"
          >
            Registrar devolución
          </button>
        </div>
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
</template>
