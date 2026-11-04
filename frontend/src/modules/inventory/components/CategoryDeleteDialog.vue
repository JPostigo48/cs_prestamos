<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import { mutationConfirmation, pendingMutation } from '../../../shared/api/mutation-guard'
import { categoryDeleteKey, deleteCategory, readCategory, readDeletionPreview, setCategoryActive, type DeletionPreview } from '../api/categories-api'
import type { Category } from '../api/inventory-api'

const props = defineProps<{ category: Category }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const preview = useRemote(signal => readDeletionPreview(props.category.id, signal))
const previous = shallowRef<DeletionPreview | null>(null)
watch(preview.data, value => { if (value) previous.value = value })
const context = computed(() => preview.data.value ?? previous.value)
const busy = ref(false), error = ref(''), notice = ref(''), needsConsult = ref(false)
async function consult() {
  if (busy.value || preview.loading.value) return
  const confirm = mutationConfirmation()
  await preview.refresh()
  if (!preview.error.value && preview.data.value) {
    // Una lectura nueva confirma que la categoría aún existe, no autoriza el DELETE.
    confirm(categoryDeleteKey(props.category.id))
    needsConsult.value = false
    notice.value = 'Previsualización actualizada. El servidor volverá a validar al eliminar.'
    emit('changed')
    if (pendingMutation('category-active:' + props.category.id)) {
      try {
        await readCategory(props.category.id)
        confirm('category-active:' + props.category.id)
      } catch (cause) { error.value = errorMessage(cause) }
    }
  }
}
async function mutate(kind: 'delete' | 'deactivate') {
  if (busy.value || preview.loading.value || (kind === 'delete' && (needsConsult.value || preview.error.value || !preview.data.value?.canDelete || pendingMutation(categoryDeleteKey(props.category.id))))) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    if (kind === 'delete') await deleteCategory(props.category.id)
    else await setCategoryActive(props.category.id, false)
    emit('changed'); emit('close')
  } catch (cause) {
    error.value = errorMessage(cause)
    needsConsult.value = true
  } finally { busy.value = false }
}
</script>
<template>
  <ModalDialog title="Eliminar categoría" :subtitle="category.nombre" :busy="busy || preview.loading.value" @close="emit('close')">
    <div class="deletion-context stack">
      <p><strong>{{ category.nombre }}</strong>. El borrado físico es irreversible; desactivar es una operación distinta y reversible.</p>
      <p v-if="preview.loading.value" role="status">Consultando dependencias…</p>
      <p v-if="preview.error.value" class="error" role="alert">{{ preview.error.value }} No se confirma ningún borrado.</p>
      <p v-if="error" class="error" role="alert">{{ error }} Se conserva el contexto. Consulta de nuevo; una previsualización anterior no autoriza el borrado.</p>
      <p v-if="notice" role="status">{{ notice }}</p>
      <p v-if="context && (needsConsult || preview.error.value)">Se muestra la última consulta informativa; puede estar desactualizada.</p>
      <template v-if="context">
        <h3>{{ context.nombre }}</h3>
        <p>Recursos: {{ context.resourceCount }} · Ejemplares: {{ context.copyCount }}</p>
        <details><summary>Recursos y ejemplares afectados (identificadores)</summary><p>Recursos ({{ context.resourceIds.length }}): {{ context.resourceIds.join(', ') || 'Ninguno' }}</p><p>Ejemplares ({{ context.copyIds.length }}): {{ context.copyIds.join(', ') || 'Ninguno' }}</p><p>Accesorios ({{ context.accessoryIds.length }}): {{ context.accessoryIds.join(', ') || 'Ninguno' }}</p></details>
        <h3>Registros que se borrarían</h3>
        <p>{{ context.wouldDelete.categories }} categorías, {{ context.wouldDelete.resources }} recursos, {{ context.wouldDelete.copies }} ejemplares, {{ context.wouldDelete.accessories }} accesorios.</p>
        <ul><li v-for="blocker in context.blockers" :key="blocker.dependency">{{ blocker.dependency }} ({{ blocker.count }}): {{ blocker.reason }}</li></ul>
        <p v-if="!context.canDelete">Eliminación bloqueada por dependencias. Puedes desactivar sin borrar historia.</p>
        <p v-else>El conjunto puede eliminarse según esta consulta, incluso si está vacío. El backend revalida todas las dependencias dentro de la transacción.</p>
      </template>
      <p>No se borran préstamos, reservas, reglas, términos, sanciones, auditorías ni ningún registro histórico.</p>
      <div class="row">
        <button :disabled="busy || preview.loading.value" @click="consult">Consultar previsualización</button>
        <button :disabled="busy || preview.loading.value" @click="mutate('deactivate')">Desactivar y conservar datos</button>
        <button class="danger" :disabled="busy || preview.loading.value || !!preview.error.value || !preview.data.value?.canDelete || needsConsult || pendingMutation(categoryDeleteKey(category.id))" @click="mutate('delete')">Eliminar definitivamente</button>
      </div>
    </div>
  </ModalDialog>
</template>
<style scoped>
.deletion-context { font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.deletion-context h3 { margin: 0; font-size: 15px; }
.deletion-context ul { padding-left: 20px; list-style: disc; }
.danger { background: #b91c1c; color: white; }
@media (max-width: 600px) { .deletion-context .row > button { width: 100%; } }
</style>
