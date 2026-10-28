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
    :busy="busy"
    @close="emit('close')"
  >
    <form class="stack" @submit.prevent="save">
      <fieldset :disabled="busy" class="stack">
        <legend>Datos básicos del recurso</legend>
        <label>Nombre<input v-model="name" required maxlength="180" /></label
        ><label>Descripción<textarea v-model="description" rows="3" /></label>
        <label
          >Categoría<select v-model="categoryId" required>
            <option value="">Seleccionar</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">
              {{ item.nombre }}
            </option>
          </select></label
        >
        <p v-if="category">
          Duración heredada: {{ durationLabel(category) }}. Guardar el artículo no cambia su
          categoría para otros recursos.
        </p>
        <button class="primary" :disabled="sending || !name.trim() || !categoryId">
          Guardar datos básicos
        </button>
      </fieldset>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <template v-if="id"
      ><hr />
      <CopyManager
        :key="id"
        :resource-id="id"
        :disabled="sending"
        @busy="copyBusy = $event"
        @changed="emit('changed')"
      />
      <ContractSection title="Accesorios actuales" contract="F06" :params="{ resourceId: id }"
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
        <h3>Partes y accesorios · F07 pendiente</h3>
        <label>Nombres separados por coma<textarea v-model="parts" :disabled="sending" /></label>
        <p>
          Reemplaza la lista completa solo si el backend lo confirma. Una lista vacía solicitará
          eliminar los accesorios.
        </p>
        <button :disabled="sending">Confirmar reemplazo de accesorios</button>
      </form>
      <form class="stack" @submit.prevent="extra('policy')">
        <h3>Excepción individual de duración · F13 pendiente</h3>
        <label
          >Horas máximas<input
            v-model.number="hours"
            type="number"
            min="1"
            step="1"
            required
            :disabled="sending" /></label
        ><button :disabled="sending">Guardar excepción individual</button>
      </form>
    </template>
    <p v-else>Guarda el recurso antes de añadir ejemplares o accesorios.</p>
    <button type="button" :disabled="busy" @click="emit('close')">Cerrar editor</button>
  </ModalDialog>
</template>
