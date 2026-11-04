<script setup lang="ts">
import { ref } from 'vue'
import { getCategories, durationLabel, type Category } from '../api/inventory-api'
import { setCategoryActive, readCategory } from '../api/categories-api'
import { mutationConfirmation, pendingMutation } from '../../../shared/api/mutation-guard'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import CategoryEditorDialog from '../components/CategoryEditorDialog.vue'
import CategoryDeleteDialog from '../components/CategoryDeleteDialog.vue'

const categories = useRemote(getCategories)
const editing = ref(false), selected = ref<Category | null>(null), deleting = ref<Category | null>(null)
const busy = ref(false), error = ref(''), notice = ref('')
function edit(category: Category | null) { selected.value = category; editing.value = true }
async function toggle(category: Category) {
  if (busy.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    await setCategoryActive(category.id, !category.activo)
    notice.value = category.activo ? 'Categoría desactivada. Todos los datos se conservan.' : 'Categoría activada. Las nuevas reservas requieren políticas publicadas completas.'
    await categories.refresh()
  } catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}
async function consult(category: Category) {
  if (busy.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const confirm = mutationConfirmation()
    const result = await readCategory(category.id)
    if (result.id !== category.id || typeof result.activo !== 'boolean') throw new Error('No se confirmó el estado actual.')
    confirm('category-active:' + category.id)
    notice.value = `Estado consultado: ${result.activo ? 'activa' : 'inactiva'}.`
    await categories.refresh()
  } catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}
</script>
<template>
  <header class="row categories-heading"><div><h1>Categorías</h1><p class="muted">Condiciones de los recursos. Incluye categorías activas e inactivas.</p></div><button class="primary" :disabled="busy" @click="edit(null)">Nueva categoría</button></header>
  <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
  <RemoteState :loading="categories.loading.value" :error="categories.error.value" @retry="categories.refresh">
    <div class="category-list">
      <article v-for="category in categories.data.value" :key="category.id" class="panel category-item">
        <div><h2>{{ category.nombre }}</h2><p class="category-description">{{ category.descripcion || 'Sin descripción' }}</p></div>
        <dl><div><dt>Duración general</dt><dd>{{ durationLabel(category) }}</dd></div><div><dt>Cantidad de recursos</dt><dd>{{ category.resourceCount }}</dd></div><div><dt>Ejemplares</dt><dd>{{ category.copyCount }}</dd></div><div><dt>Estado</dt><dd>{{ category.activo ? 'Activa' : 'Inactiva' }}</dd></div></dl>
        <div class="row category-actions"><button :disabled="busy" @click="edit(category)">Editar</button><button :disabled="busy || pendingMutation('category-active:' + category.id)" @click="toggle(category)">{{ category.activo ? 'Desactivar' : 'Activar' }}</button><button v-if="pendingMutation('category-active:' + category.id)" :disabled="busy" @click="consult(category)">Consultar estado</button><button :disabled="busy" @click="deleting = category">Eliminar</button></div>
      </article>
      <p v-if="categories.data.value?.length === 0" class="panel">No hay categorías registradas.</p>
    </div>
  </RemoteState>
  <CategoryEditorDialog v-if="editing" :category="selected" @close="editing = false" @changed="categories.refresh" />
  <CategoryDeleteDialog v-if="deleting" :category="deleting" @close="deleting = null" @changed="categories.refresh" />
</template>
<style scoped>
.categories-heading { justify-content: space-between; margin-bottom: 24px; }
.categories-heading p { font-size: 14px; }
.category-list { display: grid; gap: 16px; }
.category-item { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
.category-item h2 { font-size: 18px; margin: 0 0 8px; overflow-wrap: anywhere; }
.category-description { color: #64748b; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; font-size: 14px; }
.category-item dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0; }
.category-item dt { color: #64748b; font-size: 12px; }
.category-item dd { margin: 4px 0 0; font-weight: 700; font-size: 14px; }
.category-actions { grid-column: 1 / -1; }
@media (max-width: 600px) { .category-item { grid-template-columns: minmax(0, 1fr); } .category-actions button { flex: 1; } }
</style>
