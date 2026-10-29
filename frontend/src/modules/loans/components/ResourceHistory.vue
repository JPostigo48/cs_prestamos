<script setup lang="ts">
import { ref } from 'vue'
import { getResourceHistory, type Loan } from '../api/loans-api'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import { dateTime } from '../../../shared/format'
const props = defineProps<{ resourceId: string }>()
const page = ref(1)
const status = ref<'' | Loan['status']>('')
const remote = useRemote(signal => getResourceHistory(props.resourceId, { page: String(page.value), limit: '20', status: status.value }, signal), () => true, false)
function filter() { page.value = 1; void remote.refresh() }
function move(offset: number) { page.value += offset; void remote.refresh() }
</script>
<template>
  <section class="panel stack">
    <h2>Historial del artículo</h2>
    <form class="row" @submit.prevent="filter">
      <label>Estado<select v-model="status" :disabled="remote.loading.value"><option value="">Todos</option><option value="PLANIFICADO">Planificado</option><option value="ACTIVO">Activo</option><option value="FINALIZADO">Finalizado</option></select></label>
      <button :disabled="remote.loading.value">Consultar / actualizar historial</button>
    </form>
    <RemoteState :loading="remote.loading.value" :error="remote.error.value" @retry="remote.refresh">
      <template v-if="remote.data.value">
        <p>{{ remote.data.value.total }} préstamos</p>
        <p v-for="loan in remote.data.value.items" :key="loan.id">{{ loan.id }} · {{ loan.status }} · {{ dateTime(loan.endsAt) }}</p>
        <p v-if="!remote.data.value.items.length">No hay préstamos en la respuesta recibida.</p>
        <nav class="row" aria-label="Páginas del historial">
          <button :disabled="remote.loading.value || page <= 1" @click="move(-1)">Anterior</button>
          <span>Página {{ remote.data.value.page }}</span>
          <button :disabled="remote.loading.value || page * remote.data.value.limit >= remote.data.value.total" @click="move(1)">Siguiente</button>
        </nav>
      </template>
    </RemoteState>
  </section>
</template>
