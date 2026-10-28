<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCategories, getResources, type Resource } from '../api/inventory-api'
import ResourceCard from '../components/ResourceCard.vue'
import ResourceEditorDialog from '../components/ResourceEditorDialog.vue'
import { catalogFilters, resourceDestination } from '../catalog-query'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'

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
  <div class="row">
    <h1>{{ management ? 'Gestión de catálogo' : 'Catálogo' }}</h1>
    <button
      v-if="management"
      class="primary"
      @click="edit(null)"
    >
      Nuevo artículo
    </button>
  </div>
  <form class="panel row" @submit.prevent="update({ search: search.trim() || undefined })">
    <label
      >Buscar por nombre
      <input v-model="search" type="search" maxlength="120" @input="searchChanged"
    /></label>
    <label
      >Categoría
      <select
        :value="filters.categoryId"
        @change="update({ categoryId: ($event.target as HTMLSelectElement).value || undefined })"
      >
        <option value="">Todas</option>
        <option
          v-if="
            filters.categoryId &&
            !categories.data.value?.some((category) => category.id === filters.categoryId)
          "
          :value="filters.categoryId"
        >
          Categoría {{ filters.categoryId }}
        </option>
        <option v-for="category in categories.data.value" :key="category.id" :value="category.id">
          {{ category.nombre }}
        </option>
      </select></label
    >
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
    <label
      >Por página
      <select
        :value="filters.limit"
        @change="update({ limit: ($event.target as HTMLSelectElement).value })"
      >
        <option v-if="![10, 20, 50, 100].includes(filters.limit)">{{ filters.limit }}</option>
        <option v-for="limit in [10, 20, 50, 100]" :key="limit">{{ limit }}</option>
      </select></label
    >
    <button type="submit">Buscar</button>
  </form>
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
      <div v-if="management" class="panel table-wrap desktop-only">
        <table>
          <caption>Inventario · {{ resources.data.value.total }} artículos</caption>
          <thead><tr><th>Artículo</th><th>Categoría</th><th>Disponibilidad</th><th>Acciones</th></tr></thead>
          <tbody><tr v-for="resource in resources.data.value.data" :key="resource.id">
            <td><RouterLink :to="resourceDestination(resource.id, route.query, true)">{{ resource.nombre }}</RouterLink><p class="muted">{{ resource.id }}</p></td>
            <td>{{ categories.data.value?.find(c => c.id === resource.categoriaId)?.nombre || resource.categoriaId }}</td>
            <td><strong>{{ resource.availableCopies }}</strong> disponibles <span class="muted">· Total de ejemplares desconocido; consultar detalle</span></td>
            <td><button @click="edit(resource)">Editar artículo y ejemplares</button></td>
          </tr></tbody>
        </table>
      </div>
      <div class="cards" :class="{ 'mobile-only': management }">
        <ResourceCard
          v-for="resource in resources.data.value.data"
          :key="resource.id"
          :resource="resource"
          :management="management"
          :category="categories.data.value?.find((c) => c.id === resource.categoriaId)"
          ><button
            v-if="management"
            @click="edit(resource)"
          >
            Editar artículo y ejemplares
          </button></ResourceCard
        >
      </div>
      <p v-if="!resources.data.value.data.length" class="panel">
        No hay recursos en esta página con estos filtros.
      </p>
      <nav aria-label="Paginación del catálogo" class="row">
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
</template>
