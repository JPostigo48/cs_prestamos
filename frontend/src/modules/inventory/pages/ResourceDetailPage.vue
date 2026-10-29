<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { durationLabel, getCopies, getResource } from '../api/inventory-api'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ContractSection from '../../../shared/components/ContractSection.vue'
import ReservationDialog from '../../loans/components/ReservationDialog.vue'
import { getSession } from '../../auth/api/auth-api'
import { isStaff } from '../../auth/access-policy'
import { dateTime } from '../../../shared/format'
import { catalogDestination } from '../catalog-query'
const reserving = ref(false)
const reservationChanged = ref(false)
const session = getSession()!
const route = useRoute()
const id = computed(() => String(route.params.resourceId))
const resource = useRemote((signal) => getResource(id.value, signal), id)
const copies = useRemote((signal) => getCopies(id.value, signal), id)
function refreshAvailability() {
  void resource.refresh()
  void copies.refresh()
}
function closeReservation() {
  reserving.value = false
  if (reservationChanged.value) {
    reservationChanged.value = false
    void copies.refresh()
    void resource.refresh()
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
          Duración máxima: {{ durationLabel(resource.data.value.categoria) }}
        </p>
      </section>
      <ContractSection :key="id + '-parts'" class="accessories" title="Partes y accesorios" contract="F06" :params="{ resourceId: id }">
        <template #default="{ data }">
          <ul class="accessory-list"><li v-for="part in (data as { items: { id: string; nombre: string }[] }).items" :key="part.id">{{ part.nombre }}</li></ul>
          <p v-if="!(data as { items: unknown[] }).items.length">El servidor confirmó que no hay accesorios.</p>
        </template>
      </ContractSection>
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
        <button
          class="primary"
          :disabled="copies.loading.value || !!copies.error.value || !copies.data.value?.some((c) => c.estado === 'DISPONIBLE')"
          @click="reserving = true"
        >
          {{ copies.data.value && !copies.error.value && !copies.loading.value && !copies.data.value.some(c => c.estado === 'DISPONIBLE') ? 'Sin disponibilidad por el momento' : 'Reservar equipo para mí' }}
        </button>
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
      <ContractSection
        v-if="isStaff(session.user.role)"
        :key="id + '-history'"
        title="Historial del artículo"
        contract="F08"
        :params="{ resourceId: id }"
        ><template #default="{ data }"
          ><p
            v-for="loan in (data as { items: { id: string; status: string; endsAt: string }[] })
              .items"
            :key="loan.id"
          >
            {{ loan.id }} · {{ loan.status }} · {{ dateTime(loan.endsAt) }}
          </p>
          <p v-if="!(data as { items: unknown[] }).items.length">
            No hay préstamos en la respuesta recibida.
          </p></template
        ></ContractSection
      >
      <section v-else class="panel">
        <h2>Historial del artículo</h2>
        <p>El historial de otros prestatarios está restringido al personal por privacidad.</p>
      </section>
      <ReservationDialog
        v-if="reserving"
        :key="id"
        :copies="copies.data.value ?? []"
        :resource-name="resource.data.value.nombre"
        @close="closeReservation"
        @created="reservationChanged = true"
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
.availability-summary { display: flex; align-items: center; gap: 16px; }
.available-number { display: block; font-size: 56px; line-height: 1.2; color: #059669; }
.availability-track { height: 8px; border-radius: 99px; background: #f1f5f9; overflow: hidden; margin-block: 20px; }
.availability-track > div { height: 100%; background: #10b981; border-radius: inherit; }
.copy-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 12px; margin-top: 16px; }
.copy-list li { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; background: #f8fafc; }
@media (max-width: 767px) { .detail-columns { grid-template-columns: minmax(0, 1fr); gap: 0; } }
@media (max-width: 600px) { .resource-heading h1 { font-size: 24px; } .availability-panel { padding: 20px; } .available-number { font-size: 40px; } }
</style>
