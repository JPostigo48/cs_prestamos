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
  <RouterLink :to="catalogDestination(route.query, route.query.origin === 'management' && session.user.role === 'ADMINISTRADOR')">{{ route.query.origin === 'management' && session.user.role === 'ADMINISTRADOR' ? 'Volver al inventario' : 'Volver al catálogo' }}</RouterLink>
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
      <h1>{{ resource.data.value.nombre }}</h1>
      <div class="detail-columns">
      <div>
      <section class="panel stack">
        <h2>Descripción y características</h2>
        <p>{{ resource.data.value.descripcion || 'Sin descripción registrada.' }}</p>
        <p>{{ resource.data.value.categoria?.nombre || 'Sin categoría disponible' }}</p>
        <p v-if="resource.data.value.categoria">
          Duración máxima: {{ durationLabel(resource.data.value.categoria) }}
        </p>
        <p class="muted">ID del recurso: {{ resource.data.value.id }}</p>
      </section>
      <ContractSection :key="id + '-parts'" title="Partes y accesorios" contract="F06" :params="{ resourceId: id }">
        <template #default="{ data }">
          <ul class="stack"><li v-for="part in (data as { items: { id: string; nombre: string }[] }).items" :key="part.id">{{ part.nombre }}</li></ul>
          <p v-if="!(data as { items: unknown[] }).items.length">El servidor confirmó que no hay accesorios.</p>
        </template>
      </ContractSection>
      </div>
      <section class="panel stack availability-panel">
        <h2>Disponibilidad actual</h2>
        <p v-if="copies.data.value && !copies.error.value && !copies.loading.value">
          <strong class="available-number">{{ copies.data.value.filter((c) => c.estado === 'DISPONIBLE').length }}</strong>
          {{ copies.data.value.filter((c) => c.estado === 'DISPONIBLE').length === 1 ? 'disponible' : 'disponibles' }} de
          {{ copies.data.value.length }} ejemplares totales
        </p>
        <p v-else>Consulta de ejemplares necesaria para conocer el total exacto.</p>
        <button
          class="primary"
          :disabled="copies.loading.value || !!copies.error.value || !copies.data.value?.some((c) => c.estado === 'DISPONIBLE')"
          @click="reserving = true"
        >
          Reservar equipo para mí
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
          <ul class="stack">
            <li v-for="copy in copies.data.value" :key="copy.id">
              {{ copy.codigoInventario }} · {{ copy.estado.replaceAll('_', ' ') }}
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
.detail-columns { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 1.5rem; align-items: start; }
.availability-panel { border-top: 4px solid #1e3a5f; }
.available-number { display: block; font-size: 3.5rem; line-height: 1.2; color: #047857; }
@media (max-width: 767px) { .detail-columns { grid-template-columns: minmax(0, 1fr); gap: 0; } }
</style>
