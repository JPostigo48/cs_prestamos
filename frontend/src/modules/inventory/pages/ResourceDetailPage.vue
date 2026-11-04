<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { durationLabel, getAccessories, getCopies, getResource } from '../api/inventory-api'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ResourceHistory from '../../loans/components/ResourceHistory.vue'
import ReservationDialog from '../../loans/components/ReservationDialog.vue'
import { getSession } from '../../auth/api/auth-api'
import { isStaff } from '../../auth/access-policy'
import { catalogDestination } from '../catalog-query'
import { listReservations } from '../../loans/api/reservations-api'
import { validLoan } from '../../loans/api/loan-contracts'
import { getHistory } from '../../users/api/student-api'
import { ApiError } from '../../../shared/api/client'
import AlertHint from '../../../shared/components/AlertHint.vue'
const reserving = ref(false)
const reservationChanged = ref(false)
const session = getSession()!
const route = useRoute()
const id = computed(() => String(route.params.resourceId))
const resource = useRemote((signal) => getResource(id.value, signal), id)
const copies = useRemote((signal) => getCopies(id.value, signal), id)
const accessories = useRemote((signal) => getAccessories(id.value, signal), id)
const currentOperation = useRemote(async (signal) => {
  const [reservations, loans] = await Promise.all([
    listReservations({ userId: session.user.id, status: 'CONFIRMADA', page: '1', limit: '1' }, signal),
    getHistory(session.user.id, signal),
  ])
  if (!Array.isArray(loans) || loans.some((loan) => !validLoan(loan) || loan.userId !== session.user.id))
    throw new ApiError('No se pudo confirmar el estado de tus préstamos.', 0)
  return {
    reservation: reservations.total > 0,
    loan: loans.some((loan) => loan.status === 'ACTIVO' || loan.status === 'PLANIFICADO'),
  }
}, id)
const reservationBlockedMessage = computed(() => {
  if (currentOperation.loading.value) return 'Consultando tus reservas y préstamos.'
  if (currentOperation.error.value || !currentOperation.data.value) return 'No pudimos comprobar tus operaciones. Actualiza la disponibilidad para reintentar.'
  if (currentOperation.data.value.reservation) return 'Ya tienes una reserva activa.'
  if (currentOperation.data.value.loan) return 'Ya tienes un préstamo activo o pendiente de entrega.'
  return ''
})
const canReserve = computed(() => !reservationBlockedMessage.value && resource.data.value?.available !== false
  && !resource.loading.value && !resource.error.value && !copies.loading.value && !copies.error.value
  && !!copies.data.value?.some((copy) => copy.estado === 'DISPONIBLE'))
async function openReservation() {
  if (!canReserve.value) return
  await currentOperation.refresh()
  if (canReserve.value) reserving.value = true
}
function refreshCurrentOperation() { void currentOperation.refresh() }
onMounted(() => window.addEventListener('focus', refreshCurrentOperation))
onBeforeUnmount(() => window.removeEventListener('focus', refreshCurrentOperation))
function reservationUpdated() {
  reservationChanged.value = true
  refreshCurrentOperation()
}
function refreshAvailability() {
  void resource.refresh()
  void copies.refresh()
  refreshCurrentOperation()
}
function closeReservation() {
  reserving.value = false
  if (reservationChanged.value) {
    reservationChanged.value = false
    void copies.refresh()
    void resource.refresh()
    refreshCurrentOperation()
  }
}
</script>
<template>
  <RouterLink class="back-link" :to="catalogDestination(route.query, route.query.origin === 'management' && session.user.role === 'ADMINISTRADOR')">← {{ route.query.origin === 'management' && session.user.role === 'ADMINISTRADOR' ? 'Volver al inventario' : 'Volver al catálogo' }}</RouterLink>
  <section v-if="resource.status.value === 404" class="panel">
    <h1>Recurso no encontrado</h1>
    <p>Puede haber sido retirado del catálogo.</p>
  </section>
  <RemoteState
    v-else
    :loading="resource.loading.value"
    :error="resource.error.value"
    @retry="resource.refresh"
  >
    <template v-if="resource.data.value">
      <header class="resource-heading">
        <span class="resource-category">{{ resource.data.value.categoria?.nombre || 'Sin categoría disponible' }}</span>
        <h1>{{ resource.data.value.nombre }}</h1>
        <p class="muted">ID del recurso: {{ resource.data.value.id }}</p>
      </header>
      <div class="detail-columns">
      <div>
      <section class="panel stack">
        <h2>Descripción</h2>
        <p>{{ resource.data.value.descripcion || 'Sin descripción registrada.' }}</p>
        <p v-if="resource.data.value.categoria">
          Duración máxima: {{ durationLabel({ ...resource.data.value.categoria, tiempoMaximoPrestamoHoras: resource.data.value.loanPolicy.effectiveDurationHours }) }}
          {{ resource.data.value.loanPolicy.source === 'RESOURCE' ? '(excepción individual)' : '(regla de categoría)' }}
        </p>
      </section>
      <section class="panel accessories">
        <h2>Partes y accesorios</h2>
        <RemoteState :loading="accessories.loading.value" :error="accessories.error.value" @retry="accessories.refresh">
          <ul class="accessory-list"><li v-for="part in accessories.data.value?.items" :key="part.id">{{ part.nombre }}</li></ul>
          <p v-if="accessories.data.value?.items.length === 0">El servidor confirmó que no hay accesorios.</p>
        </RemoteState>
      </section>
      </div>
      <section class="panel stack availability-panel">
        <h2>Disponibilidad actual</h2>
        <div v-if="copies.data.value && !copies.error.value && !copies.loading.value" class="availability-summary">
          <strong class="available-number">{{ copies.data.value.filter((c) => c.estado === 'DISPONIBLE').length }}</strong>
          <p>
          {{ copies.data.value.filter((c) => c.estado === 'DISPONIBLE').length === 1 ? 'disponible' : 'disponibles' }} de
          {{ copies.data.value.length }} ejemplares totales</p>
        </div>
        <p v-else>Consulta de ejemplares necesaria para conocer el total exacto.</p>
        <div v-if="copies.data.value && !copies.error.value && !copies.loading.value" class="availability-track" aria-hidden="true"><div :style="{ width: (copies.data.value.length ? copies.data.value.filter(c => c.estado === 'DISPONIBLE').length / copies.data.value.length * 100 : 0) + '%' }" /></div>
        <div class="reservation-control">
        <button
          class="primary"
          :disabled="!canReserve"
          :aria-describedby="reservationBlockedMessage ? 'reservation-blocked-status' : undefined"
          @click="openReservation"
        >
          Reservar ejemplar
        </button>
        <AlertHint v-if="reservationBlockedMessage" :message="reservationBlockedMessage" label="Por qué no puedo reservar" />
        </div>
        <span v-if="reservationBlockedMessage" id="reservation-blocked-status" class="sr-only" role="status">{{ reservationBlockedMessage }}</span>
        <p v-if="resource.data.value.available === false">No disponible para nuevas reservas. La actividad del recurso/categoría y las políticas se revalidan en el servidor.</p>
      </section>
      </div>
      <section class="panel">
        <h2>Ejemplares</h2>
        <RemoteState
          :loading="copies.loading.value"
          :error="copies.error.value"
          @retry="copies.refresh"
        >
          <ul class="copy-list">
            <li v-for="copy in copies.data.value" :key="copy.id">
              <strong>{{ copy.codigoInventario }}</strong><span class="badge">{{ copy.estado.replaceAll('_', ' ') }}</span>
            </li>
          </ul>
          <p v-if="copies.data.value?.length === 0">No hay ejemplares registrados.</p>
        </RemoteState>
      </section>
      <button @click="refreshAvailability">
        Actualizar disponibilidad
      </button>
      <ResourceHistory
        v-if="isStaff(session.user.role)"
        :key="id + '-history'"
        :resource-id="id"
      />
      <section v-else class="panel">
        <h2>Historial del recurso</h2>
        <p>El historial de otros prestatarios está restringido al personal por privacidad.</p>
      </section>
      <ReservationDialog
        v-if="reserving"
        :key="id"
        :copies="copies.data.value ?? []"
        :resource-name="resource.data.value.nombre"
        @close="closeReservation"
        @created="reservationUpdated"
      />
    </template>
  </RemoteState>
</template>
<style scoped>
.back-link { display: inline-flex; margin-bottom: 20px; font-size: 14px; font-weight: 600; color: #64748b; text-decoration: none; }
.resource-heading { margin-bottom: 24px; }
.resource-heading h1 { margin: 12px 0 8px; font-size: 32px; line-height: 1.2; }
.resource-heading p { font-size: 12px; }
.resource-category { background: #e2e8f0; color: #475569; padding: 4px 12px; border-radius: 99px; text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: .05em; }
.detail-columns { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 24px; align-items: start; }
.detail-columns h2 { font-size: 14px; font-weight: 700; }
.detail-columns p { font-size: 14px; line-height: 1.7; }
.accessory-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 8px; }
.accessory-list li { display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 10px; border: 1px solid #f1f5f9; border-radius: 8px; font-size: 13px; color: #475569; }
.accessory-list li::before { content: ''; height: 6px; width: 6px; flex-shrink: 0; border-radius: 50%; background: #3b82f6; }
.availability-panel { padding: 28px; }
.availability-panel button { width: 100%; padding-block: 12px; font-weight: 700; }
.reservation-control { display: flex; align-items: center; gap: 8px; }
.reservation-control > .primary { flex: 1; }
.availability-summary { display: flex; align-items: center; gap: 16px; }
.available-number { display: block; font-size: 56px; line-height: 1.2; color: #059669; }
.availability-track { height: 8px; border-radius: 99px; background: #f1f5f9; overflow: hidden; margin-block: 20px; }
.availability-track > div { height: 100%; background: #10b981; border-radius: inherit; }
.copy-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 12px; margin-top: 16px; }
.copy-list li { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; background: #f8fafc; }
@media (max-width: 767px) { .detail-columns { grid-template-columns: minmax(0, 1fr); gap: 0; } }
@media (max-width: 600px) { .resource-heading h1 { font-size: 24px; } .availability-panel { padding: 20px; } .available-number { font-size: 40px; } }
</style>
