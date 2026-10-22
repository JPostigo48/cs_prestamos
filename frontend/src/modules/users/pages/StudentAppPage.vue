<template>
  <div class="min-h-dvh bg-[#f5f7fb] text-slate-900 lg:flex">
    <aside class="hidden w-[232px] shrink-0 flex-col bg-[#1e3a5f] text-white lg:flex">
      <div class="flex h-[72px] items-center gap-3 border-b border-white/10 px-4">
        <img src="/logo.png" alt="" class="h-9 w-9 object-contain" />
        <span class="font-bold">CS Préstamos</span>
      </div>
      <nav class="space-y-1 px-3 py-4" aria-label="Navegación del usuario">
        <button type="button" class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm" :class="view === 'home' ? 'bg-[#294f82] text-white' : 'text-blue-100 hover:bg-white/10'" @click="goHome"><House :size="18" /> Inicio</button>
        <button type="button" class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm" :class="view !== 'home' ? 'bg-[#294f82] text-white' : 'text-blue-100 hover:bg-white/10'" @click="showCatalog()"><LibraryBig :size="18" /> Catálogo</button>
      </nav>
    </aside>

    <div class="min-w-0 flex-1">
      <header class="hidden min-h-[72px] items-center justify-between gap-5 border-b border-slate-200 bg-white px-7 lg:flex">
        <label class="relative w-full max-w-[470px]">
          <span class="sr-only">Buscar recursos</span>
          <Search :size="17" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="search" type="search" placeholder="Buscar recursos..." class="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500" @input="showCatalog()" />
        </label>
        <div class="flex shrink-0 items-center gap-5">
          <span class="text-sm font-semibold">{{ dashboard?.user.name }}</span>
          <button type="button" class="flex items-center gap-1 text-sm text-slate-600 hover:text-red-600" @click="logout"><LogOut :size="17" /> Salir</button>
        </div>
      </header>

      <main class="mx-auto max-w-[1480px] space-y-7 px-4 pb-24 pt-6 sm:px-6 lg:px-9 lg:pb-10 lg:pt-8">
        <div v-if="loading" role="status" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">Cargando tu información…</div>
        <div v-else-if="error" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p>{{ error }}</p>
          <button type="button" class="mt-3 text-sm font-semibold underline" @click="refresh">Volver a intentar</button>
        </div>
        <template v-else-if="dashboard">
          <p v-if="notice" role="status" class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{{ notice }}</p>

          <template v-if="view === 'home'">
            <section>
              <p class="text-sm text-slate-500">Bienvenido/a,</p>
              <h1 class="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{{ dashboard.user.name }}</h1>
              <div class="mt-3 flex flex-wrap gap-2">
                <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="dashboard.eligibility.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'">
                  ● Cuenta {{ dashboard.eligibility.enabled ? 'habilitada para préstamos' : 'no habilitada para préstamos' }}
                </span>
                <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">★ Confianza: {{ dashboard.trust.percentage }} % · {{ trustLabel }}</span>
              </div>
              <p v-if="!dashboard.eligibility.enabled && dashboard.eligibility.reasons?.length" class="mt-3 text-sm text-red-700">{{ dashboard.eligibility.reasons.map(eligibilityReason).join('. ') }}</p>
            </section>

            <section>
              <div class="mb-3 flex items-center justify-between">
                <h2 class="text-sm font-bold uppercase tracking-wide lg:text-lg lg:normal-case">Explorar catálogo</h2>
                <button type="button" class="text-xs font-medium text-blue-600 hover:underline lg:text-sm" @click="showCatalog()">Ver todo ›</button>
              </div>
              <div v-if="dashboard.categories.length" class="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3">
                <button v-for="(category, index) in dashboard.categories" :key="category.id" type="button" class="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300 sm:p-5 lg:border-transparent" :class="categoryTone(index)" @click="showCatalog(category.id)">
                  <component :is="categoryIcon(index)" :size="21" class="mb-2 text-blue-600" />
                  <h3 class="truncate text-sm font-bold">{{ category.nombre }}</h3>
                  <p class="mt-1 text-xs text-slate-500">{{ category.resourceCount }} recursos</p>
                  <p class="mt-3 border-t border-slate-100 pt-2 text-xs font-semibold text-emerald-700">{{ availableForCategory(category.id) }} disp.</p>
                </button>
              </div>
              <p v-else class="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Aún no hay categorías registradas.</p>
            </section>

            <section>
              <div class="mb-3 flex items-center justify-between">
                <h2 class="text-sm font-bold uppercase tracking-wide lg:text-lg lg:normal-case">Mis préstamos</h2>
                <span class="text-xs text-slate-500 lg:text-sm">{{ currentLoans.length }} activos o planificados</span>
              </div>
              <div class="space-y-2 lg:hidden">
                <article v-for="loan in currentLoans" :key="loan.id" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0"><h3 class="truncate text-sm font-bold">{{ loanName(loan) }}</h3><p class="mt-1 text-xs text-slate-500">{{ loanCode(loan) }} · {{ loanCategory(loan) }}</p></div>
                    <span class="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">{{ loan.status === 'PLANIFICADO' ? 'Planificado' : 'En préstamo' }}</span>
                  </div>
                  <p class="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-600"><Clock3 :size="13" class="mr-1 inline" />Hasta {{ formatDate(loan.endsAt) }}</p>
                </article>
                <p v-if="!currentLoans.length" class="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">No tienes préstamos activos ni planificados.</p>
              </div>
              <div class="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white lg:block">
                <table class="w-full min-w-[640px] text-left text-sm">
                  <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-5 py-3">Artículo</th><th class="px-5 py-3">Categoría</th><th class="px-5 py-3">Fecha límite</th><th class="px-5 py-3">Estado</th></tr></thead>
                  <tbody>
                    <tr v-for="loan in currentLoans" :key="loan.id" class="border-b border-slate-100 last:border-0">
                      <td class="px-5 py-4"><strong>{{ loanName(loan) }}</strong><span class="block text-xs text-slate-500">{{ loanCode(loan) }}</span></td>
                      <td class="px-5 py-4 text-slate-600">{{ loanCategory(loan) }}</td>
                      <td class="px-5 py-4">{{ formatDate(loan.endsAt) }}</td>
                      <td class="px-5 py-4"><span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{{ loan.status === 'PLANIFICADO' ? 'Planificado' : 'En préstamo' }}</span></td>
                    </tr>
                    <tr v-if="!currentLoans.length"><td colspan="4" class="px-5 py-6 text-center text-slate-500">No tienes préstamos activos ni planificados.</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 class="mb-3 text-sm font-bold uppercase tracking-wide lg:text-lg lg:normal-case">Historial de sanciones</h2>
              <div class="rounded-xl border border-slate-200 bg-white">
                <p v-if="!dashboard.sanctions.length" class="p-5 text-center text-sm text-slate-500">No tienes ninguna sanción en tu historial.</p>
                <article v-for="sanction in dashboard.sanctions" :key="sanction.id" class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4 last:border-0 sm:p-5">
                  <div>
                    <h3 class="text-sm font-semibold">Sanción {{ sanction.status.toLowerCase() }}</h3>
                    <p class="mt-1 text-xs text-slate-600">Inicio: {{ formatDate(sanction.startsAt) }} · Fin: {{ sanction.endsAt ? formatDate(sanction.endsAt) : 'sin fecha registrada' }}</p>
                    <p class="mt-1 text-xs text-slate-600">Confianza: {{ sanction.previousTrust }} % → {{ sanction.resultingTrust }} %</p>
                    <button v-if="sanction.status === 'ACTIVA' && sanction.violationId" type="button" class="mt-2 text-xs font-semibold text-blue-600 hover:underline" @click="openAppeal(sanction)">Apelar sanción</button>
                  </div>
                  <span class="rounded-md px-2 py-1 text-xs font-semibold" :class="sanction.status === 'ACTIVA' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'">{{ sanction.status }}</span>
                </article>
              </div>
            </section>
          </template>

          <template v-else-if="view === 'catalog'">
            <div><p class="text-sm text-slate-500">Explorar recursos</p><h1 class="text-2xl font-bold sm:text-3xl">Catálogo</h1><p class="mt-1 text-sm text-slate-500">{{ filteredResources.length }} recursos encontrados</p></div>
            <label class="relative block lg:hidden"><Search :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="search" type="search" placeholder="Buscar recursos..." class="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm" /></label>
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="rounded-lg px-3 py-2 text-xs font-medium sm:text-sm" :class="selectedCategory === null ? 'bg-[#1e3a5f] text-white' : 'bg-white text-slate-600'" @click="selectedCategory = null">Todos</button>
              <button v-for="category in dashboard.categories" :key="category.id" type="button" class="rounded-lg px-3 py-2 text-xs font-medium sm:text-sm" :class="selectedCategory === category.id ? 'bg-[#1e3a5f] text-white' : 'bg-white text-slate-600'" @click="selectedCategory = category.id">{{ category.nombre }}</button>
              <label class="ml-auto flex items-center gap-2 text-xs text-slate-600 sm:text-sm"><input v-model="onlyAvailable" type="checkbox" /> Solo disponibles</label>
            </div>
            <div v-if="filteredResources.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <button v-for="resource in filteredResources" :key="resource.id" type="button" class="rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-blue-300 hover:shadow-sm" @click="selectedResource = resource; view = 'detail'">
                <p class="text-xs font-semibold text-blue-600">{{ categoryName(resource.categoriaId) }}</p>
                <h2 class="mt-2 font-bold">{{ resource.nombre }}</h2>
                <p class="mt-1 line-clamp-2 text-sm text-slate-500">{{ resource.descripcion || 'Sin descripción registrada.' }}</p>
                <p class="mt-4 border-t border-slate-100 pt-3 text-xs font-medium" :class="resource.availableCopies ? 'text-emerald-700' : 'text-red-600'">{{ resource.availableCopies }} de {{ resource.totalCopies }} ejemplares disponibles</p>
              </button>
            </div>
            <p v-else class="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No se encontraron recursos.</p>
          </template>

          <template v-else-if="view === 'detail' && selectedResource">
            <button type="button" class="text-sm font-medium text-blue-600 hover:underline" @click="view = 'catalog'">‹ Volver al catálogo</button>
            <div><p class="text-sm font-semibold text-blue-600">{{ categoryName(selectedResource.categoriaId) }}</p><h1 class="mt-1 text-2xl font-bold sm:text-3xl">{{ selectedResource.nombre }}</h1></div>
            <div class="grid gap-4 lg:grid-cols-2">
              <section class="rounded-xl border border-slate-200 bg-white p-5"><h2 class="font-bold">Descripción</h2><p class="mt-2 text-sm text-slate-600">{{ selectedResource.descripcion || 'Sin descripción registrada.' }}</p></section>
              <section class="rounded-xl border border-slate-200 bg-white p-5"><h2 class="font-bold">Disponibilidad</h2><p class="mt-2 text-2xl font-bold text-emerald-700">{{ selectedResource.availableCopies }} <span class="text-sm font-normal text-slate-500">de {{ selectedResource.totalCopies }} ejemplares</span></p><p class="mt-2 text-sm text-slate-600">Tiempo máximo: {{ categoryDuration(selectedResource.categoriaId) }} días</p></section>
            </div>
          </template>
        </template>
      </main>
    </div>

    <nav class="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-slate-200 bg-white px-4 py-2 lg:hidden" aria-label="Navegación del usuario">
      <button type="button" class="flex flex-col items-center gap-1 px-4 text-xs" :class="view === 'home' ? 'text-blue-600' : 'text-slate-500'" @click="goHome"><House :size="21" />Inicio</button>
      <button type="button" class="flex flex-col items-center gap-1 px-4 text-xs" :class="view !== 'home' ? 'text-blue-600' : 'text-slate-500'" @click="showCatalog()"><LibraryBig :size="21" />Catálogo</button>
      <button type="button" class="flex flex-col items-center gap-1 px-4 text-xs text-red-600" @click="logout"><LogOut :size="21" />Salir</button>
    </nav>

    <div v-if="appealingSanction" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <form class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" @submit.prevent="sendAppeal">
        <h2 class="text-lg font-bold">Apelar sanción</h2>
        <p class="mt-1 text-sm text-slate-500">Explica por qué consideras que la sanción debe revisarse.</p>
        <textarea v-model.trim="appealReason" required maxlength="2000" rows="5" class="mt-4 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-600" />
        <p v-if="appealError" role="alert" class="mt-2 text-sm text-red-700">{{ appealError }}</p>
        <div class="mt-4 flex justify-end gap-3"><button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-sm" @click="appealingSanction = null">Cancelar</button><button type="submit" :disabled="sendingAppeal" class="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{{ sendingAppeal ? 'Enviando…' : 'Enviar apelación' }}</button></div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Clock3, House, Laptop, LibraryBig, LogOut, Search, Trophy } from '@lucide/vue'
import { ApiError } from '../../../shared/api/client'
import { clearSession, getSession } from '../../auth/api/auth-api'
import { loadDashboard, submitAppeal } from '../api/student-api'
import type { DashboardData, Loan, Resource, Sanction } from '../api/student-api'

const router = useRouter()
const session = getSession()
const controller = new AbortController()
const dashboard = ref<DashboardData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notice = ref('')
const view = ref<'home' | 'catalog' | 'detail'>('home')
const search = ref('')
const onlyAvailable = ref(false)
const selectedCategory = ref<string | null>(null)
const selectedResource = ref<Resource | null>(null)
const appealingSanction = ref<Sanction | null>(null)
const appealReason = ref('')
const appealError = ref<string | null>(null)
const sendingAppeal = ref(false)

const trustLabels: Record<DashboardData['trust']['level'], string> = {
  CRITICO: 'Crítico', EN_OBSERVACION: 'En observación', CONFIABLE: 'Confiable', EXCELENTE: 'Excelente',
}
const trustLabel = computed(() => dashboard.value ? trustLabels[dashboard.value.trust.level] : '')
const currentLoans = computed(() => dashboard.value?.loans.filter(loan => loan.status !== 'FINALIZADO') ?? [])
const filteredResources = computed(() => dashboard.value?.resources.filter(resource =>
  (!selectedCategory.value || resource.categoriaId === selectedCategory.value) &&
  (!onlyAvailable.value || resource.availableCopies > 0) &&
  (resource.nombre.toLowerCase().includes(search.value.toLowerCase()) ||
    resource.descripcion?.toLowerCase().includes(search.value.toLowerCase()))
) ?? [])
const dateFormatter = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })
const formatDate = (value: string) => dateFormatter.format(new Date(value))
const categoryName = (id: string) => dashboard.value?.categories.find(category => category.id === id)?.nombre ?? 'Sin categoría'
const categoryDuration = (id: string) => dashboard.value?.categories.find(category => category.id === id)?.tiempoMaximoPrestamoDias ?? '—'
const availableForCategory = (id: string) => dashboard.value?.resources.filter(resource => resource.categoriaId === id).reduce((total, resource) => total + resource.availableCopies, 0) ?? 0
const loanName = (loan: Loan) => dashboard.value?.copies[loan.copyId]?.recurso.nombre ?? 'Ejemplar ' + loan.copyId
const loanCode = (loan: Loan) => dashboard.value?.copies[loan.copyId]?.codigoInventario ?? loan.copyId
const loanCategory = (loan: Loan) => categoryName(dashboard.value?.copies[loan.copyId]?.recurso.categoriaId ?? '')
const categoryIcon = (index: number) => [Laptop, BookOpen, Trophy][index % 3]
const eligibilityReason = (reason: string) => ({
  VINCULACION_NO_VIGENTE: 'La vinculación institucional no está vigente',
  SANCION_ACTIVA: 'Tienes una sanción activa',
}[reason] ?? reason)
const categoryTone = (index: number) => ['lg:bg-[#edf4ff]', 'lg:bg-[#fbf4ff]', 'lg:bg-[#effbf3]'][index % 3]

function goHome(): void { view.value = 'home' }
function showCatalog(categoryId?: string): void {
  selectedCategory.value = categoryId ?? null
  view.value = 'catalog'
}
function logout(): void {
  clearSession()
  void router.replace('/login')
}
async function refresh(): Promise<void> {
  if (!session) return
  loading.value = true
  error.value = null
  try {
    dashboard.value = await loadDashboard(session, controller.signal)
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') return
    if (cause instanceof ApiError && cause.status === 401) {
      logout()
      return
    }
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar tu información.'
  } finally {
    loading.value = false
  }
}
function openAppeal(sanction: Sanction): void {
  appealingSanction.value = sanction
  appealReason.value = ''
  appealError.value = null
}
async function sendAppeal(): Promise<void> {
  if (!session || !appealingSanction.value || sendingAppeal.value || !appealReason.value) return
  sendingAppeal.value = true
  appealError.value = null
  try {
    await submitAppeal(session, appealingSanction.value.id, appealReason.value)
    appealingSanction.value = null
    notice.value = 'Apelación registrada. Un administrador revisará la solicitud.'
  } catch (cause) {
    appealError.value = cause instanceof Error ? cause.message : 'No se pudo enviar la apelación.'
  } finally {
    sendingAppeal.value = false
  }
}

onMounted(() => { void refresh() })
onUnmounted(() => controller.abort())
</script>
