<script setup lang="ts">
import { ref } from 'vue'
import { getCopies, createCopy, changeCopyState, type Copy } from '../api/inventory-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
const props = defineProps<{ resourceId: string; disabled?: boolean }>()
const emit = defineEmits<{ changed: []; busy: [value: boolean] }>()
const copies = useRemote((signal) => getCopies(props.resourceId, signal))
const code = ref(''),
  sending = ref(false),
  error = ref(''),
  notice = ref('')
const selected = ref<Copy | null>(null)
async function add() {
  if (sending.value || props.disabled || !code.value.trim()) return
  sending.value = true
  emit('busy', true)
  error.value = ''
  notice.value = ''
  try {
    const result = await createCopy(props.resourceId, code.value)
    notice.value = 'Ejemplar confirmado: ' + result.codigoInventario
    code.value = ''
    await copies.refresh()
    emit('changed')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
    emit('busy', false)
  }
}
async function state() {
  if (!selected.value || sending.value || props.disabled) return
  sending.value = true
  emit('busy', true)
  error.value = ''
  notice.value = ''
  try {
    await changeCopyState(
      selected.value,
      selected.value.estado === 'DISPONIBLE' ? 'NO_DISPONIBLE' : 'DISPONIBLE',
    )
    selected.value = null
    await copies.refresh()
    notice.value = 'Estado confirmado por el servidor.'
    emit('changed')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
    emit('busy', false)
  }
}
</script>
<template>
  <section class="stack copy-manager">
    <h3>Ejemplares y códigos de inventario</h3>
    <p class="muted">Cada ejemplar tiene un código único. Las cantidades se calculan a partir de los ejemplares registrados.</p>
    <RemoteState :loading="copies.loading.value" :error="copies.error.value" @retry="copies.refresh"
      ><p v-if="copies.data.value">Total exacto: {{ copies.data.value.length }}</p>
      <ul class="copy-list">
        <li v-for="copy in copies.data.value" :key="copy.id">
          <div><strong>{{ copy.codigoInventario }}</strong><StatusBadge :tone="copy.estado === 'DISPONIBLE' ? 'success' : copy.estado === 'NO_DISPONIBLE' ? 'neutral' : 'warning'">{{ copy.estado.replaceAll('_', ' ') }}</StatusBadge></div>
          <button
            v-if="copy.estado === 'DISPONIBLE' || copy.estado === 'NO_DISPONIBLE'"
            type="button"
            :disabled="sending || disabled"
            @click="selected = copy"
          >
            {{ copy.estado === 'DISPONIBLE' ? 'Inhabilitar' : 'Habilitar' }}
          </button>
        </li>
      </ul>
      <p v-if="copies.data.value?.length === 0">No hay ejemplares.</p></RemoteState
    >
    <div v-if="selected" class="panel copy-confirmation" role="group" aria-label="Confirmar cambio de disponibilidad">
      <p>¿Cambiar disponibilidad de {{ selected.codigoInventario }}?</p>
      <button type="button" :disabled="sending" @click="selected = null">Cancelar</button
      ><button type="button" :disabled="sending" @click="state">Confirmar cambio</button>
    </div>
    <form class="row" @submit.prevent="add">
      <label
        >Código único del nuevo ejemplar<input
          v-model="code"
          required
          maxlength="80"
          :disabled="sending" /></label
      ><button class="primary" :disabled="sending || disabled || !code.trim()">Añadir ejemplar</button>
    </form>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
  </section>
</template>
<style scoped>
.copy-manager h3 { font-size: 15px; font-weight: 800; }
.copy-manager p { font-size: 12px; line-height: 1.6; }
.copy-list { list-style: none; padding: 0; }
.copy-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; margin-bottom: 8px; }
.copy-list li > div { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.copy-list strong { font-family: ui-monospace, monospace; font-size: 12px; }
.copy-list button { font-size: 11px; }
.copy-manager .row { align-items: end; }
.copy-manager label { flex: 1 1 200px; font-size: 12px; color: #64748b; font-weight: 600; }
.copy-manager input { width: 100%; margin-top: 6px; }
.copy-confirmation { background: #fffbeb; border-color: #fde68a; }
.copy-confirmation p { margin-bottom: 12px; }
.copy-confirmation button { margin: 0 8px 8px 0; }
</style>
