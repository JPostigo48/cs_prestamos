<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { getCopy, getAccessories, type Accessory } from '../../inventory/api/inventory-api'
import { saveReturnChecklist } from '../api/loans-api'
import { errorMessage } from '../../../shared/composables/useRemote'
import { ClipboardCheck } from '@lucide/vue'
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
  <section class="inspection stack">
    <h3><ClipboardCheck :size="18" aria-hidden="true" />Checklist de partes y accesorios</h3>
    <p class="muted">Guardar la inspección no registra la devolución ni aplica sanciones.</p>
    <button type="button" :disabled="disabled || loading || sending" @click="load">
      {{ loading ? 'Consultando…' : 'Consultar accesorios para revisar' }}
    </button>
    <fieldset v-if="parts" :disabled="disabled || sending" class="inspection-parts">
      <legend>Verifica cada parte (ninguna está marcada por defecto)</legend>
      <div v-for="part in parts" :key="part.id" class="inspection-part" role="group" :aria-labelledby="'inspection-part-' + part.id">
        <strong :id="'inspection-part-' + part.id">{{ part.nombre }}</strong>
        <div class="inspection-options"><label
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
        ></div>
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
<style scoped>
.inspection { border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
.inspection h3 { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
.inspection p { font-size: 12px; line-height: 1.7; }
.application .inspection button { font-size: 12px; font-weight: 600; }
.inspection-parts { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px; }
.inspection-parts > legend { font-size: 11px; color: #64748b; padding: 0 4px; }
.inspection-part { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 10px; border: 0; margin: 0 0 8px; padding: 4px 0; }
.inspection-part:last-of-type { margin-bottom: 0; }
.inspection-part strong { font-size: 13px; font-weight: 600; color: #334155; }
.inspection-options { display: flex; flex-wrap: wrap; gap: 12px; }
.application .inspection-options label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; }
.application .inspection-options input[type='radio'] { width: 16px; height: 16px; margin: 0; accent-color: #2563eb; }
@media (max-width: 360px) { .inspection-part { grid-template-columns: minmax(0,1fr); gap: 4px; } }
</style>
