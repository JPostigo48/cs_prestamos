<script setup lang="ts">
import { ref, watch } from 'vue'
import { listAppeals } from '../api/trust-api'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import { dateTime } from '../../../shared/format'
const props = defineProps<{ userId: string; revision?: number }>()
const page = ref(1), status = ref('')
watch(() => [props.userId, props.revision], () => { page.value = 1 })
const remote = useRemote(signal => listAppeals({ userId: props.userId, status: status.value, page: page.value }, signal), () => [props.userId, props.revision])
async function consult() { page.value = 1; await remote.refresh() }
async function move(delta: number) { page.value += delta; await remote.refresh() }
</script>
<template>
  <section class="panel stack">
    <h2>Estado de mis apelaciones</h2>
    <label>Estado<select v-model="status" @change="consult"><option value="">Todos</option><option value="PENDIENTE">Pendiente de revisión</option><option value="ACEPTADA">Aceptada</option><option value="RECHAZADA">Rechazada</option></select></label>
    <RemoteState :loading="remote.loading.value" :error="remote.error.value" @retry="remote.refresh">
      <template v-if="remote.data.value">
        <article v-for="appeal in remote.data.value.items" :key="appeal.id"><p>{{ appeal.reason }} · {{ appeal.status }} · {{ dateTime(appeal.submittedAt) }}</p><p v-if="appeal.resolution">Resolución: {{ appeal.resolution }} · {{ appeal.resolvedAt ? dateTime(appeal.resolvedAt) : 'Sin fecha de resolución' }}</p></article>
        <p v-if="!remote.data.value.items.length">No hay apelaciones en la respuesta recibida.</p>
        <nav class="row" aria-label="Páginas de mis apelaciones"><button :disabled="remote.loading.value || page <= 1" @click="move(-1)">Anterior</button><span>Página {{ remote.data.value.page }} · {{ remote.data.value.total }} apelaciones</span><button :disabled="remote.loading.value || page * remote.data.value.limit >= remote.data.value.total" @click="move(1)">Siguiente</button></nav>
      </template>
    </RemoteState>
  </section>
</template>
