<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCategories, getResources, type Resource } from '../api/inventory-api'
import ResourceCard from '../components/ResourceCard.vue'
import ResourceEditorDialog from '../components/ResourceEditorDialog.vue'
import { catalogFilters, resourceDestination } from '../catalog-query'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import { Search, Plus, Pencil } from '@lucide/vue'
import CategoryIcon from '../components/CategoryIcon.vue'

const route = useRoute()
defineProps<{ management?: boolean }>()
const editing = ref(false),
  selected = ref<Resource | null>(null)
const router = useRouter()
const filters = computed(() => catalogFilters(route.query))
const categories = useRemote(getCategories)
const resources = useRemote(
  (signal) => getResources(filters.value, signal),
  () => JSON.stringify(filters.value),
)
const resourceGroups = computed(() => {
  const groups = new Map<string, { id: string; name: string; items: Resource[] }>()
  for (const item of resources.data.value?.data ?? []) {
    if (!groups.has(item.categoriaId)) groups.set(item.categoriaId, {
      id: item.categoriaId,
      name: categories.data.value?.find(c => c.id === item.categoriaId)?.nombre || 'Categoría no disponible',
      items: [],
    })
    groups.get(item.categoriaId)!.items.push(item)
  }
  return [...groups.values()]
})
const search = ref(filters.value.search)
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => route.fullPath,
  () => {
    clearTimeout(timer)
    search.value = filters.value.search
  },
)
function update(values: Record<string, string | undefined>) {
  clearTimeout(timer)
  void router.push({ path: route.path, query: { ...route.query, page: undefined, ...values } })
}
function searchChanged() {
  clearTimeout(timer)
  timer = setTimeout(() => update({ search: search.value.trim() || undefined }), 300)
}
function edit(resource: Resource | null) {
  selected.value = resource
  editing.value = true
}
function refreshInventory() {
  void resources.refresh()
  void categories.refresh()
}
onBeforeUnmount(() => clearTimeout(timer))
const pages = computed(() =>
  resources.data.value
    ? Math.max(1, Math.ceil(resources.data.value.total / filters.value.limit))
    : 1,
)
</script>
<template>
  <section :class="{ 'inventory-management': management }">
  <div class="catalog-heading row">
    <div>
    <p v-if="!management" class="catalog-eyebrow">Explorar recursos</p>
    <h1>{{ management ? 'Gestión del Inventario' : 'Catálogo' }}</h1>
    <p class="muted">{{ management ? 'Administra los artículos, sus categorías y los ejemplares del catálogo.' : 'Encuentra los recursos que necesitas y consulta su disponibilidad.' }}</p>
    </div>
    <button
      v-if="management"
      class="primary"
      @click="edit(null)"
    >
      <Plus :size="18" aria-hidden="true" /> <span class="new-article-label">Nuevo artículo</span>
    </button>
  </div>
  <form class="panel catalog-filters" role="search" aria-label="Filtrar catálogo" @submit.prevent="update({ search: search.trim() || undefined })">
    <label class="catalog-search"
      ><span class="sr-only">Buscar por nombre</span><Search :size="18" aria-hidden="true" />
      <input v-model="search" type="search" placeholder="Buscar artículo…" maxlength="120" @input="searchChanged"
    /></label>
    <label
      >Disponibilidad
      <select
        :value="filters.available"
        @change="update({ available: ($event.target as HTMLSelectElement).value || undefined })"
      >
        <option value="">Todas</option>
        <option value="true">Con ejemplares disponibles</option>
        <option value="false">Sin ejemplares disponibles</option>
      </select></label
    >
    <button type="submit" class="primary">Buscar</button>
  </form>
  <nav class="category-filters" aria-label="Categorías del catálogo">
    <button :aria-pressed="!filters.categoryId" @click="update({ categoryId: undefined })">Todas las categorías</button>
    <button v-for="category in categories.data.value" :key="category.id" :aria-pressed="filters.categoryId === category.id" @click="update({ categoryId: category.id })">{{ category.nombre }}</button>
    <button v-if="filters.categoryId && !categories.data.value?.some(c => c.id === filters.categoryId)" aria-pressed="true" @click="update({ categoryId: undefined })">Categoría seleccionada · quitar filtro</button>
  </nav>
  <p v-if="categories.error.value" class="error" role="alert">
    No se pudieron cargar las categorías. El catálogo sigue disponible.
    <button @click="categories.refresh">Reintentar categorías</button>
  </p>
  <RemoteState
    :loading="resources.loading.value"
    :error="resources.error.value"
    @retry="resources.refresh"
  >
    <template v-if="resources.data.value">
      <p class="muted" role="status">
        {{ resources.data.value.total }} recursos encontrados · página {{ filters.page }} de
        {{ pages }}
      </p>
      <div v-if="management" class="panel table-wrap desktop-only inventory-table" tabindex="0" role="region" aria-label="Inventario de recursos">
        <table>
          <caption>Inventario · {{ resources.data.value.total }} artículos</caption>
          <thead><tr><th>Artículo</th><th>Categoría</th><th>Disponibilidad</th><th>Acciones</th></tr></thead>
          <tbody><tr v-for="resource in resources.data.value.data" :key="resource.id">
            <td><RouterLink :to="resourceDestination(resource.id, route.query, true)">{{ resource.nombre }}</RouterLink><p v-if="resource.descripcion" class="muted inventory-description">{{ resource.descripcion }}</p></td>
            <td><span class="inventory-category">{{ categories.data.value?.find(c => c.id === resource.categoriaId)?.nombre || 'Categoría no disponible' }}</span></td>
            <td><strong class="inventory-stock" :class="{ empty: resource.availableCopies === 0 }">{{ resource.availableCopies }}</strong> disponibles<small>Total de ejemplares desconocido; consultar detalle</small></td>
            <td><button class="inventory-edit" @click="edit(resource)"><Pencil :size="15" aria-hidden="true" /> Editar artículo y ejemplares</button></td>
          </tr></tbody>
        </table>
      </div>
      <div class="cards catalog-grid" :class="{ 'mobile-only': management }">
        <template v-for="group in resourceGroups" :key="group.id">
          <h2 v-if="!management" class="catalog-group-heading" :class="{ books: /libro/i.test(group.name), sports: /deport/i.test(group.name) }"><CategoryIcon :name="group.name" :size="20" /><span>{{ group.name }}</span><small>{{ group.items.length }} en esta página</small></h2>
        <ResourceCard
          v-for="resource in group.items"
          :key="resource.id"
          :resource="resource"
          :management="management"
          :grouped="!management"
          :category="categories.data.value?.find((c) => c.id === resource.categoriaId)"
          ><button
            v-if="management"
            @click="edit(resource)"
          >
            Editar artículo y ejemplares
          </button></ResourceCard
        >
        </template>
      </div>
      <p v-if="!resources.data.value.data.length" class="panel">
        No hay recursos en esta página con estos filtros.
      </p>
      <nav aria-label="Paginación del catálogo" class="row">
        <label>Por página <select :value="filters.limit" @change="update({ limit: ($event.target as HTMLSelectElement).value })"><option v-if="![10,20,50,100].includes(filters.limit)">{{ filters.limit }}</option><option v-for="limit in [10,20,50,100]" :key="limit">{{ limit }}</option></select></label>
        <button :disabled="filters.page <= 1" @click="update({ page: String(filters.page - 1) })">
          Anterior
        </button>
        <button
          :disabled="filters.page >= pages"
          @click="update({ page: String(filters.page + 1) })"
        >
          Siguiente
        </button>
        <button v-if="filters.page > pages" @click="update({ page: '1' })">
          Volver a la primera página
        </button>
      </nav>
    </template>
  </RemoteState>
  <ResourceEditorDialog
    v-if="editing"
    :resource="selected"
    :categories="categories.data.value ?? []"
    @close="editing = false"
    @changed="refreshInventory"
  />
  </section>
</template>
<style scoped>
.inventory-management .catalog-heading { margin-bottom: 28px; }
.inventory-management .catalog-heading h1 { letter-spacing: -.025em; margin: 0 0 8px; }
.inventory-management .catalog-heading > button { display: inline-flex; gap: 8px; align-items: center; padding: 12px 20px; font-size: 13px; font-weight: 700; border-radius: 12px; }
.inventory-management [role='status'] { font-size: 12px; margin-bottom: 12px; }
.inventory-table { padding: 0; border-radius: 16px; box-shadow: 0 1px 3px #0f172a08; }
.inventory-table table { min-width: 820px; }
.inventory-table caption { text-align: left; padding: 14px 24px; font-size: 12px; color: #64748b; caption-side: bottom; }
.inventory-table :is(td,th) { padding: 20px 24px; }
.inventory-table td:first-child { width: 40%; }
.inventory-table td:first-child a { color: #0f172a; font-size: 16px; font-weight: 800; text-decoration: none; }
.inventory-table tbody tr:hover { background: #f8fafc; }
.inventory-description { font-size: 12px; margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.inventory-category { display: inline-block; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; white-space: nowrap; }
.inventory-stock { color: #059669; font-size: 20px; }
.inventory-stock.empty { color: #ef4444; }
.inventory-table small { display: block; color: #64748b; font-size: 10px; margin-top: 4px; }
.inventory-table .inventory-edit { display: inline-flex; align-items: center; gap: 8px; background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; font-size: 12px; font-weight: 700; }
.catalog-heading { justify-content: space-between; margin-bottom: 24px; }
.catalog-heading h1 { margin: 4px 0; }
.catalog-heading .muted { font-size: 14px; }
.catalog-eyebrow { color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.catalog-filters { display: flex; align-items: end; flex-wrap: wrap; gap: 12px; box-shadow: 0 1px 2px #0f172a05; }
.catalog-filters label { font-size: 12px; font-weight: 600; color: #64748b; }
.catalog-filters select { display: block; margin-top: 4px; }
.catalog-search { position: relative; flex: 1 1 240px; }
.catalog-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
.catalog-filters .catalog-search input[type='search'] { width: 100%; padding-left: 38px; background: #f8fafc; }
.category-filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0; }
.category-filters button { font-size: 14px; padding: 8px 16px; }
.category-filters [aria-pressed='true'] { background: #1e3a5f; border-color: #1e3a5f; color: white; }
.catalog-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 16px 0 24px; }
.inventory-management .catalog-grid.mobile-only { display: grid; gap: 16px; }
@media (min-width: 1024px) { .inventory-management .catalog-grid.mobile-only { display: none; } }
.catalog-group-heading { display: none; }
@media (max-width: 1023px) {
  .catalog-grid .catalog-group-heading { display: flex; grid-column: 1 / -1; align-items: center; flex-wrap: wrap; gap: 8px; margin: 8px 0 0; padding: 12px 16px; border: 1px solid #dbeafe; border-radius: 8px; background: #eff6ff; font-size: 14px; }
  .catalog-group-heading > svg { color: #2563eb; }
  .catalog-group-heading small { font-size: 11px; font-weight: 500; color: #64748b; }
  .catalog-grid .catalog-group-heading.books { background: #faf5ff; border-color: #f3e8ff; }
  .catalog-grid .catalog-group-heading.books > svg { color: #9333ea; }
  .catalog-grid .catalog-group-heading.sports { background: #f0fdf4; border-color: #dcfce7; }
  .catalog-grid .catalog-group-heading.sports > svg { color: #059669; }
}
@media (max-width: 1279px) { .catalog-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .catalog-grid { grid-template-columns: minmax(0, 1fr); } .catalog-filters { padding: 12px; } .catalog-search { flex-basis: 100%; } .catalog-filters label:not(.catalog-search) { flex: 1; min-width: 0; } .catalog-filters select { width: 100%; } .category-filters button { padding: 8px 12px; font-size: 12px; } }
@media (max-width: 600px) {
  .inventory-management .catalog-heading { position: relative; margin-bottom: 20px; }
  .inventory-management .catalog-heading h1 { padding-right: 50px; }
  .inventory-management .catalog-heading > button { position: absolute; top: 0; right: 0; padding: 10px; border-radius: 8px; }
  .new-article-label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
</style>
