<script setup lang="ts">
import { ref } from 'vue'
import { getCopies, createCopy, changeCopyState, type Copy } from '../api/inventory-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
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
  <section class="stack">
    <h3>Ejemplares y códigos de inventario</h3>
    <p>La cantidad se deriva de las copias registradas, no del número editado en un formulario.</p>
    <RemoteState :loading="copies.loading.value" :error="copies.error.value" @retry="copies.refresh"
      ><p v-if="copies.data.value">Total exacto: {{ copies.data.value.length }}</p>
      <ul class="stack">
        <li v-for="copy in copies.data.value" :key="copy.id">
          {{ copy.codigoInventario }} · {{ copy.estado }}
          <button
            v-if="copy.estado === 'DISPONIBLE' || copy.estado === 'NO_DISPONIBLE'"
            type="button"
            :disabled="sending"
            @click="selected = copy"
          >
            {{ copy.estado === 'DISPONIBLE' ? 'Inhabilitar' : 'Habilitar' }}
          </button>
        </li>
      </ul>
      <p v-if="copies.data.value?.length === 0">No hay ejemplares.</p></RemoteState
    >
    <div v-if="selected" class="panel">
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
      ><button :disabled="sending || !code.trim()">Añadir ejemplar</button>
    </form>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
  </section>
</template>
