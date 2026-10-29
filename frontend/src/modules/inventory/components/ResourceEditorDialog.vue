<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  saveResource,
  saveAccessories,
  saveLoanPolicy,
  durationLabel,
  type Category,
  type Resource,
} from '../api/inventory-api'
import CopyManager from './CopyManager.vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import ContractSection from '../../../shared/components/ContractSection.vue'
import { errorMessage } from '../../../shared/composables/useRemote'
import { Package, ClipboardList, Clock, Layers } from '@lucide/vue'
const props = defineProps<{ resource: Resource | null; categories: Category[] }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const id = ref(props.resource?.id ?? null),
  name = ref(props.resource?.nombre ?? ''),
  categoryId = ref(props.resource?.categoriaId ?? ''),
  description = ref(props.resource?.descripcion ?? '')
const parts = ref(''),
  hours = ref<number | null>(null),
  sending = ref(false),
  error = ref(''),
  notice = ref('')
const copyBusy = ref(false)
const section = ref<'basic' | 'copies' | 'parts' | 'policy'>('basic')
const busy = computed(() => sending.value || copyBusy.value)
const category = computed(() => props.categories.find((c) => c.id === categoryId.value))
async function save() {
  if (busy.value) return
  sending.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await saveResource(id.value, {
      nombre: name.value.trim(),
      categoriaId: categoryId.value,
      ...(description.value.trim()
        ? { descripcion: description.value.trim() }
        : id.value
          ? { descripcion: null }
          : {}),
    })
    id.value = result.id
    notice.value =
      'Datos básicos confirmados. Ejemplares, accesorios y excepción de duración se guardan por separado.'
    emit('changed')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
  }
}
async function extra(kind: 'parts' | 'policy') {
  if (!id.value || busy.value) return
  sending.value = true
  error.value = ''
  notice.value = ''
  try {
    if (kind === 'parts') {
      const names = parts.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (new Set(names).size !== names.length) throw new Error('No repitas nombres de accesorios.')
      await saveAccessories(id.value, names)
      notice.value = 'Accesorios confirmados por el servidor.'
    } else {
      if (!hours.value || !Number.isInteger(hours.value) || hours.value < 1)
        throw new Error('La duración debe ser un entero positivo.')
      await saveLoanPolicy(id.value, hours.value)
      notice.value = 'Excepción de duración confirmada por el servidor.'
    }
    emit('changed')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
  }
}
</script>
<template>
  <ModalDialog
    :title="id ? 'Editar artículo' : 'Nuevo artículo'"
    :subtitle="resource?.nombre || 'Registra un recurso del catálogo'"
    :busy="busy"
    @close="emit('close')"
  >
    <div class="resource-editor">
    <nav v-if="id" class="editor-tabs" aria-label="Secciones del artículo"><button :aria-pressed="section === 'basic'" :disabled="busy" @click="section = 'basic'"><Package :size="16" aria-hidden="true" /> Artículo</button><button :aria-pressed="section === 'copies'" :disabled="busy" @click="section = 'copies'"><Layers :size="16" aria-hidden="true" /> Ejemplares</button><button :aria-pressed="section === 'parts'" :disabled="busy" @click="section = 'parts'"><ClipboardList :size="16" aria-hidden="true" /> Accesorios</button><button :aria-pressed="section === 'policy'" :disabled="busy" @click="section = 'policy'"><Clock :size="16" aria-hidden="true" /> Duración</button></nav>
    <form v-show="section === 'basic'" class="stack" @submit.prevent="save">
      <fieldset :disabled="busy" class="basic-fields">
        <legend>Datos del artículo</legend>
        <label>Nombre<input v-model="name" required maxlength="180" /></label>
        <label
          >Categoría<select v-model="categoryId" required>
            <option value="">Seleccionar</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">
              {{ item.nombre }}
            </option>
          </select></label
        >
        <label class="full-field">Descripción<textarea v-model="description" rows="3" /></label>
        <p v-if="category" class="category-policy full-field"><Clock :size="16" aria-hidden="true" />
          Duración de la categoría: {{ durationLabel(category) }}. Esta regla se hereda; guardar el artículo no modifica la categoría.
        </p>
        <button class="primary full-field" :disabled="sending || !name.trim() || !categoryId">
          Guardar datos básicos
        </button>
      </fieldset>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <template v-if="id"
      ><section v-show="section === 'copies'" class="editor-section"><CopyManager
        :key="id"
        :resource-id="id"
        :disabled="sending"
        @busy="copyBusy = $event"
        @changed="emit('changed')"
      /></section>
      <section v-show="section === 'parts'" class="editor-section"><ContractSection title="Accesorios actuales" contract="F06" :params="{ resourceId: id }"
        ><template #default="{ data }"
          ><ul>
            <li
              v-for="item in (data as { items: { id: string; nombre: string }[] }).items"
              :key="item.id"
            >
              {{ item.nombre }}
            </li>
          </ul></template
        ></ContractSection
      >
      <form class="stack" @submit.prevent="extra('parts')">
        <h3>Partes y accesorios</h3>
        <label>Nombres separados por coma<textarea v-model="parts" :disabled="sending" /></label>
        <p>
          Esta acción reemplaza la lista completa. Una lista vacía solicitará
          eliminar los accesorios.
        </p>
        <button class="primary" :disabled="sending">Confirmar reemplazo de accesorios</button>
      </form></section>
      <form v-show="section === 'policy'" class="stack editor-section" @submit.prevent="extra('policy')">
        <h3>Duración del préstamo</h3>
        <p class="category-policy">{{ category ? 'Regla de la categoría: ' + durationLabel(category) + '.' : 'Selecciona una categoría para conocer su regla.' }} La excepción se aplica únicamente a este artículo.</p>
        <label
          >Horas máximas<input
            v-model.number="hours"
            type="number"
            min="1"
            step="1"
            required
            :disabled="sending" /></label
        ><button class="primary" :disabled="sending">Guardar excepción individual</button>
      </form>
    </template>
    <p v-else>Guarda el recurso antes de añadir ejemplares o accesorios.</p>
    <button type="button" :disabled="busy" @click="emit('close')">Cerrar editor</button>
    </div>
  </ModalDialog>
</template>
<style scoped>
.editor-tabs { display: flex; gap: 4px; padding-bottom: 12px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; overflow-x: auto; }
.editor-tabs button { display: flex; gap: 5px; align-items: center; flex-shrink: 0; font-size: 11px; font-weight: 700; border-color: transparent; padding: 8px; }
.editor-tabs [aria-pressed='true'] { color: #1e3a5f; background: #e8edf4; }
.basic-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; border: 0; padding: 0; margin: 0 0 20px; min-width: 0; }
.basic-fields legend { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 800; letter-spacing: .06em; margin-bottom: 16px; }
.resource-editor label { font-size: 12px; color: #64748b; font-weight: 700; }
.resource-editor :is(input,select,textarea) { display: block; width: 100%; margin-top: 6px; font-weight: 400; }
.full-field { grid-column: 1 / -1; }
.category-policy { display: flex; align-items: start; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12px; color: #64748b; line-height: 1.6; }
.editor-section { margin: 0 0 20px; }
.editor-section h3 { font-size: 15px; font-weight: 800; }
.editor-section p { font-size: 12px; line-height: 1.6; }
.resource-editor > button:last-child { width: 100%; background: #f1f5f9; font-weight: 700; }
@media (max-width: 375px) { .basic-fields { grid-template-columns: minmax(0, 1fr); } }
</style>
