<template>
  <div class="min-h-screen w-full bg-[#f5f7fb] text-slate-900 lg:flex">
    <aside class="flex w-[232px] shrink-0 flex-col bg-[#1e3a5f] text-white">
      <div class="flex h-[72px] items-center gap-3 border-b border-white/10 px-4">
        <img src="/logo.png" alt="" class="h-9 w-9 object-contain" />
        <span class="font-bold">CS Préstamos</span>
      </div>
      <nav class="space-y-1 px-3 py-4" aria-label="Navegación del usuario">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition"
          :class="view === 'student-home' ? 'bg-[#294f82] font-semibold text-white' : 'text-blue-100 hover:bg-white/10'"
          @click="emit('home')"
        >
          <span aria-hidden="true" class="text-lg">⌂</span> Inicio
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition"
          :class="view !== 'student-home' ? 'bg-[#294f82] font-semibold text-white' : 'text-blue-100 hover:bg-white/10'"
          @click="emit('catalog', 'all')"
        >
          <span aria-hidden="true" class="text-lg">▦</span> Catálogo
        </button>
      </nav>
    </aside>

    <div class="min-w-0 flex-1">
      <header class="flex min-h-[72px] items-center justify-between gap-4 border-b border-slate-200 bg-white px-6">
        <label class="relative block w-full max-w-[470px]">
          <span class="sr-only">Buscar recursos</span>
          <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>
          <input
            v-model="search"
            type="search"
            placeholder="Buscar recursos..."
            class="w-full rounded-md border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
            @input="view === 'student-home' && emit('catalog', 'all')"
          />
        </label>
        <div class="flex shrink-0 items-center gap-5">
          <span class="text-sm font-semibold">{{ user?.name }}</span>
          <button type="button" class="text-sm text-slate-500 hover:text-red-600" aria-label="Cerrar sesión" @click="emit('logout')">
            Salir
          </button>
        </div>
      </header>

      <main class="mx-auto max-w-[1480px] space-y-7 px-6 py-8 xl:px-9">
        <div v-if="toast" role="status" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{{ toast }}</div>

        <template v-if="view === 'student-home'">
          <section>
            <p class="text-sm text-slate-500">Bienvenido/a,</p>
            <h1 class="mt-1 text-3xl font-bold tracking-tight">{{ user?.name }}</h1>
            <div class="mt-3 flex flex-wrap gap-2">
              <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="suspended ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'">
                ● Cuenta {{ suspended ? 'suspendida' : 'habilitada' }}
              </span>
              <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">★ Nivel de confianza: {{ level }}</span>
            </div>
          </section>

          <section v-if="suspended" class="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <h2 class="font-semibold">{{ activeSanction ? 'Sanción activa' : 'Cuenta suspendida' }}</h2>
            <p class="mt-1">{{ activeSanction ? activeSanction.reason + '. Vigente hasta ' + activeSanction.until + '.' : 'Comunícate con la Escuela de Ciencias de la Computación para más información.' }}</p>
            <button v-if="activeSanction && !appeal" type="button" class="mt-3 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700" @click="emit('openAppeal')">Apelar sanción</button>
            <p v-else-if="appeal" class="mt-2">Apelación: {{ appeal.status.toLowerCase() }}.</p>
          </section>

          <section>
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-lg font-bold">Explorar catálogo</h2>
              <button type="button" class="text-sm font-medium text-blue-600 hover:underline" @click="emit('catalog', 'all')">Ver todo ›</button>
            </div>
            <div class="grid gap-4 md:grid-cols-3">
              <button type="button" class="rounded-xl bg-[#edf4ff] p-5 text-left hover:ring-2 hover:ring-blue-300" @click="emit('catalog', 'electricos')">
                <span class="text-xl text-blue-600" aria-hidden="true">▣</span>
                <h3 class="mt-2 font-bold">Electrónicos</h3>
                <p class="text-sm text-slate-500">{{ categoryCounts.electricos }} recursos</p>
                <p class="mt-3 border-t border-white/70 pt-3 text-xs font-semibold text-emerald-700">{{ availableByCategory.electricos }} disp.</p>
              </button>
              <button type="button" class="rounded-xl bg-[#fbf4ff] p-5 text-left hover:ring-2 hover:ring-purple-300" @click="emit('catalog', 'libros')">
                <span class="text-xl text-purple-600" aria-hidden="true">▥</span>
                <h3 class="mt-2 font-bold">Libros</h3>
                <p class="text-sm text-slate-500">{{ categoryCounts.libros }} recursos</p>
                <p class="mt-3 border-t border-white/70 pt-3 text-xs font-semibold text-emerald-700">{{ availableByCategory.libros }} disp.</p>
              </button>
              <button type="button" class="rounded-xl bg-[#effbf3] p-5 text-left hover:ring-2 hover:ring-emerald-300" @click="emit('catalog', 'deportes')">
                <span class="text-xl text-emerald-600" aria-hidden="true">◇</span>
                <h3 class="mt-2 font-bold">Deportes</h3>
                <p class="text-sm text-slate-500">{{ categoryCounts.deportes }} recursos</p>
                <p class="mt-3 border-t border-white/70 pt-3 text-xs font-semibold text-emerald-700">{{ availableByCategory.deportes }} disp.</p>
              </button>
            </div>
          </section>

          <section>
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-lg font-bold">Mis préstamos activos</h2>
              <span class="text-sm text-slate-500">{{ loans.length }} activos</span>
            </div>
            <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table class="w-full min-w-[650px] text-left text-sm">
                <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th class="px-5 py-3">Artículo</th><th class="px-5 py-3">Categoría</th><th class="px-5 py-3">Fecha / hora límite</th><th class="px-5 py-3">Estado</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(loan, index) in loans" :key="loan.code ?? index" class="border-b border-slate-100 last:border-0">
                    <td class="px-5 py-4"><strong>{{ loan.item }}</strong><span class="block text-xs text-slate-500">{{ loan.code }}</span></td>
                    <td class="px-5 py-4 text-slate-600">{{ loan.category }}</td>
                    <td class="px-5 py-4">{{ loan.date }}<span v-if="loan.daysLeft !== undefined" class="ml-2 text-xs" :class="loan.daysLeft < 0 ? 'text-red-600' : 'text-amber-700'">{{ loan.daysLeft }}d</span></td>
                    <td class="px-5 py-4"><span class="rounded-full px-3 py-1 text-xs font-medium" :class="(loan.daysLeft ?? 0) < 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'">{{ (loan.daysLeft ?? 0) < 0 ? 'En mora' : 'En préstamo' }}</span></td>
                  </tr>
                  <tr v-if="loans.length === 0"><td colspan="4" class="px-5 py-6 text-center text-slate-500">No tienes préstamos activos.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 class="mb-3 text-lg font-bold">Historial de sanciones</h2>
            <div class="rounded-xl border border-slate-200 bg-white">
              <p v-if="!user?.sanctions.length" class="px-5 py-5 text-center text-sm text-slate-500">No tienes ninguna sanción en tu historial.</p>
              <div v-for="sanction in user?.sanctions" :key="sanction.id" class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
                <div><h3 class="font-semibold">{{ sanction.rule }}</h3><p class="mt-1 text-sm text-slate-500">{{ sanction.reason }} · Hasta {{ sanction.until }}</p></div>
                <span class="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">ACTIVA</span>
              </div>
            </div>
          </section>
        </template>

        <template v-else-if="view === 'catalog'">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div><p class="text-sm text-slate-500">Explorar recursos</p><h1 class="text-3xl font-bold">Catálogo</h1><p class="mt-1 text-sm text-slate-500">{{ visibleItems.length }} recursos encontrados</p></div>
            <label class="flex items-center gap-2 text-sm text-slate-600"><input v-model="onlyAvailable" type="checkbox" /> Solo disponibles</label>
          </div>
          <div class="flex flex-wrap gap-2">
            <button v-for="category in categories" :key="category.key" type="button" class="rounded-lg px-4 py-2 text-sm font-medium" :class="selectedCategory === category.key ? 'bg-[#1e3a5f] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'" @click="emit('catalog', category.key)">{{ category.label }}</button>
          </div>
          <div v-if="visibleItems.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <button v-for="item in visibleItems" :key="item.code" type="button" class="rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-300 hover:shadow-sm" @click="emit('selectItem', item.code)">
              <div class="flex items-start justify-between gap-3"><span class="text-xs font-semibold text-blue-600">{{ item.categoryName }}</span><span class="text-xs text-slate-500">{{ item.code }}</span></div>
              <h2 class="mt-3 font-bold">{{ item.name }}</h2>
              <p class="mt-1 line-clamp-2 text-sm text-slate-500">{{ item.description }}</p>
              <div class="mt-5 flex justify-between border-t border-slate-100 pt-3 text-xs"><span :class="item.availableCount ? 'text-emerald-700' : 'text-red-600'">{{ item.availableCount }} disponibles</span><span class="text-slate-500">{{ item.maxTime }}</span></div>
            </button>
          </div>
          <p v-else class="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No se encontraron recursos con los filtros aplicados.</p>
        </template>

        <template v-else-if="view === 'item-detail' && selectedItem">
          <button type="button" class="text-sm font-medium text-blue-600 hover:underline" @click="emit('catalog', selectedCategory)">‹ Volver al catálogo</button>
          <div><p class="text-sm font-semibold text-blue-600">{{ selectedItem.categoryName }}</p><h1 class="mt-1 text-3xl font-bold">{{ selectedItem.name }}</h1><p class="mt-1 text-sm text-slate-500">Código: {{ selectedItem.code }}</p></div>
          <div class="grid gap-5 xl:grid-cols-2">
            <section class="rounded-xl border border-slate-200 bg-white p-6"><h2 class="font-bold">Descripción</h2><p class="mt-2 text-sm text-slate-600">{{ selectedItem.description }}</p><h2 class="mt-6 font-bold">Partes y accesorios</h2><ul class="mt-2 space-y-2 text-sm text-slate-600"><li v-for="part in selectedItem.parts" :key="part">• {{ part }}</li></ul></section>
            <section class="rounded-xl border border-slate-200 bg-white p-6"><h2 class="font-bold">Disponibilidad</h2><p class="mt-3 text-2xl font-bold" :class="selectedItem.availableCount ? 'text-emerald-700' : 'text-red-600'">{{ selectedItem.availableCount }} <span class="text-sm font-normal text-slate-500">de {{ selectedItem.totalCount }} ejemplares</span></p><p class="mt-3 text-sm text-slate-600">Tiempo máximo: {{ selectedItem.maxTime }}</p><p v-if="suspended" class="mt-4 text-sm text-red-700">Tu cuenta se encuentra suspendida.</p></section>
          </div>
          <section class="rounded-xl border border-slate-200 bg-white p-6"><h2 class="font-bold">Historial del artículo</h2><div v-if="selectedItem.history.length" class="mt-3 divide-y divide-slate-100"><div v-for="(record, index) in selectedItem.history" :key="index" class="flex justify-between py-3 text-sm"><span>{{ record.user }}</span><span class="text-slate-500">{{ record.date }} · {{ record.status }}</span></div></div><p v-else class="mt-3 text-sm text-slate-500">Este artículo no registra préstamos anteriores.</p></section>
        </template>
      </main>
    </div>

    <div v-if="appealOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-5">
      <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 class="text-lg font-bold">Formular apelación</h2>
        <p class="mt-1 text-sm text-slate-500">Motivo original: {{ activeSanction?.reason }}</p>
        <textarea v-model="appealText" rows="5" placeholder="Explica tu justificación o agrega enlaces de evidencia..." class="mt-4 w-full resize-none rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none"></textarea>
        <div class="mt-4 flex justify-end gap-3"><button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-sm" @click="emit('closeAppeal')">Cancelar</button><button type="button" :disabled="!appealText.trim()" class="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" @click="emit('submitAppeal')">Enviar apelación</button></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Category = 'all' | 'electricos' | 'libros' | 'deportes'
interface CatalogItem {
  category: Exclude<Category, 'all'>
  categoryName: string
  code: string
  name: string
  description: string
  availableCount: number
  totalCount: number
  maxTime: string
  parts: string[]
  history: { user: string; date: string; status: string }[]
}
interface Sanction { id: number; rule: string; reason: string; until: string }
interface Loan { item: string; code?: string; category?: string; date: string; daysLeft?: number }

const props = defineProps<{
  view: string
  user: { name: string; sanctions: Sanction[] } | null
  suspended: boolean
  level: string
  activeSanction: Sanction | null
  appeal: { status: string } | null
  loans: Loan[]
  items: CatalogItem[]
  catalogItems: CatalogItem[]
  selectedItem: CatalogItem | null
  selectedCategory: Category
  availableByCategory: Record<Exclude<Category, 'all'>, number>
  toast: string
  appealOpen: boolean
}>()
const emit = defineEmits<{
  home: []
  catalog: [category: Category]
  selectItem: [code: string]
  logout: []
  openAppeal: []
  closeAppeal: []
  submitAppeal: []
}>()
const search = defineModel<string>('search', { required: true })
const onlyAvailable = defineModel<boolean>('onlyAvailable', { required: true })
const appealText = defineModel<string>('appealText', { required: true })
const categories: { key: Category; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'electricos', label: 'Electrónicos' },
  { key: 'libros', label: 'Libros' },
  { key: 'deportes', label: 'Deportes' }
]
const categoryCounts = computed(() => ({
  electricos: props.catalogItems.filter(item => item.category === 'electricos').length,
  libros: props.catalogItems.filter(item => item.category === 'libros').length,
  deportes: props.catalogItems.filter(item => item.category === 'deportes').length
}))
const visibleItems = computed(() => props.items.filter(item =>
  props.selectedCategory === 'all' || item.category === props.selectedCategory
))
</script>
