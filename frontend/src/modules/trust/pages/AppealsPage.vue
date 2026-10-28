<script setup lang="ts">
import { computed, ref } from 'vue'
import { listAppeals, resolveAppeal, type Appeal } from '../api/trust-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { dateTime } from '../../../shared/format'
import { ApiError } from '../../../shared/api/client'
const filter = ref('PENDIENTE')
const remote = useRemote(
  (signal) => listAppeals(filter.value, signal),
  () => true,
  false,
)
const items = computed(() =>
  [...(remote.data.value?.items ?? [])].sort(
    (a, b) =>
      Number(b.status === 'PENDIENTE') - Number(a.status === 'PENDIENTE') ||
      a.submittedAt.localeCompare(b.submittedAt),
  ),
)
const selected = ref<Appeal | null>(null),
  outcome = ref<'ACEPTADA' | 'RECHAZADA'>('ACEPTADA'),
  resolution = ref(''),
  sending = ref(false),
  error = ref(''),
  notice = ref(''),
  uncertain = ref(false)
function select(appeal: Appeal, status: 'ACEPTADA' | 'RECHAZADA') {
  selected.value = appeal
  outcome.value = status
  resolution.value = ''
  error.value = ''
  uncertain.value = false
}
async function confirm() {
  if (!selected.value || sending.value || uncertain.value || !resolution.value.trim()) return
  sending.value = true
  error.value = ''
  try {
    const result = await resolveAppeal(selected.value.id, outcome.value, resolution.value)
    notice.value = 'Resolución confirmada: ' + result.status
    selected.value = null
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
  <h1>Apelaciones</h1>
  <p class="muted">
    Revisa las solicitudes y fundamenta cada decisión. La aceptación absuelve únicamente la sanción
    vinculada.
  </p>
  <form class="panel row" @submit.prevent="remote.refresh">
    <label
      >Estado<select v-model="filter">
        <option value="PENDIENTE">Pendientes</option>
        <option value="ACEPTADA">Aceptadas</option>
        <option value="RECHAZADA">Rechazadas</option>
        <option value="">Todos</option>
      </select></label
    ><button :disabled="remote.loading.value">Consultar bandeja</button
    ><strong>{{
      remote.data.value ? remote.data.value.total + ' apelaciones' : 'Cantidad desconocida'
    }}</strong>
  </form>
  <p v-if="notice" role="status" class="notice">{{ notice }}</p>
  <p class="muted">Lectura F04 pendiente de backend. Un error no equivale a una bandeja vacía.</p>
  <RemoteState :loading="remote.loading.value" :error="remote.error.value" @retry="remote.refresh"
    ><div class="cards">
      <article v-for="appeal in items" :key="appeal.id" class="panel stack">
        <span class="badge">{{ appeal.status }}</span>
        <h2>Apelación {{ appeal.id }}</h2>
        <p>Usuario {{ appeal.userId }}</p>
        <p>{{ appeal.reason }}</p>
        <p>{{ dateTime(appeal.submittedAt) }}</p>
        <p v-if="appeal.resolution">Resolución: {{ appeal.resolution }}</p>
        <p class="muted">Equipo y nombre no disponibles en este contrato.</p>
        <div v-if="appeal.status === 'PENDIENTE'" class="row">
          <button @click="select(appeal, 'ACEPTADA')">Aprobar apelación</button
          ><button @click="select(appeal, 'RECHAZADA')">Rechazar</button>
        </div>
      </article>
    </div>
    <p v-if="remote.data.value && !items.length" class="panel">
      No hay apelaciones en la respuesta recibida.
    </p></RemoteState
  >
  <ModalDialog
    v-if="selected"
    :title="outcome === 'ACEPTADA' ? 'Aprobar apelación' : 'Rechazar apelación'"
    :busy="sending"
    @close="selected = null"
    ><form class="stack" @submit.prevent="confirm">
      <p>{{ selected.id }} · {{ selected.reason }}</p>
      <label
        >Fundamento obligatorio<textarea
          v-model="resolution"
          required
          maxlength="2000"
          rows="5"
          :disabled="sending"
        />
      </label>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="uncertain" class="error">
        Resultado incierto. No vuelvas a resolver sin consultar el estado.
      </p>
      <div class="row">
        <button type="button" :disabled="sending" @click="selected = null">Cerrar</button
        ><button class="primary" :disabled="sending || uncertain || !resolution.trim()">
          Confirmar resolución
        </button>
      </div>
    </form></ModalDialog
  >
</template>
