<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { getCopy, getAccessories, type Accessory } from '../../inventory/api/inventory-api'
import { saveReturnChecklist } from '../api/loans-api'
import { errorMessage } from '../../../shared/composables/useRemote'
const props = defineProps<{ loanId: string; copyId: string; disabled: boolean }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const parts = ref<Accessory[] | null>(null),
  received = ref<Record<string, boolean | null>>({}),
  loading = ref(false),
  sending = ref(false),
  error = ref(''),
  notice = ref('')
const controller = new AbortController()
onBeforeUnmount(() => controller.abort())
const complete = computed(
  () => parts.value !== null && parts.value.every((p) => typeof received.value[p.id] === 'boolean'),
)
async function load() {
  if (loading.value || sending.value || props.disabled) return
  loading.value = true
  emit('busy', true)
  error.value = ''
  notice.value = ''
  parts.value = null
  try {
    const copy = await getCopy(props.copyId, controller.signal)
    const result = await getAccessories(copy.recursoId, controller.signal)
    parts.value = result.items
    received.value = Object.fromEntries(result.items.map((p) => [p.id, null]))
  } catch (cause) {
    if (!controller.signal.aborted) error.value = errorMessage(cause)
  } finally {
    loading.value = false
    emit('busy', false)
  }
}
async function save() {
  if (!complete.value || sending.value || props.disabled) return
  sending.value = true
  emit('busy', true)
  error.value = ''
  notice.value = ''
  try {
    await saveReturnChecklist(
      props.loanId,
      parts.value!.map((p) => ({ accessoryId: p.id, received: received.value[p.id] === true })),
    )
    notice.value = 'Checklist confirmado por el servidor. La devolución todavía no se ha enviado.'
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
    emit('busy', false)
  }
}
</script>
<template>
  <section class="panel stack">
    <h3>Checklist de partes y accesorios</h3>
    <p>
      F06/F09 pendientes de backend. No forma parte del contrato de devolución básica ni genera
      sanciones.
    </p>
    <button type="button" :disabled="disabled || loading || sending" @click="load">
      {{ loading ? 'Consultando…' : 'Consultar accesorios para revisar' }}
    </button>
    <fieldset v-if="parts" :disabled="disabled || sending" class="stack">
      <legend>Verifica cada parte (ninguna está marcada por defecto)</legend>
      <div v-for="part in parts" :key="part.id">
        <strong>{{ part.nombre }}</strong
        ><label
          ><input
            v-model="received[part.id]"
            type="radio"
            :name="'part-' + part.id"
            :value="true"
          />
          Recibido</label
        ><label
          ><input
            v-model="received[part.id]"
            type="radio"
            :name="'part-' + part.id"
            :value="false"
          />
          Faltante</label
        >
      </div>
      <p v-if="!parts.length">El servidor confirmó que no hay accesorios.</p>
    </fieldset>
    <button type="button" :disabled="disabled || !complete || sending || loading" @click="save">
      Guardar solo checklist
    </button>
    <p v-if="error" role="alert" class="error">
      {{ error }} El checklist no está confirmado. Puedes elegir explícitamente registrar solo la
      devolución básica.
    </p>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
  </section>
</template>
