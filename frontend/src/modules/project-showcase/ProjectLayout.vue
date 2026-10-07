<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const navigation = [
  { path: '/project', label: 'Resumen', exact: true },
  { path: '/project/sprints', label: 'Sprints' },
  { path: '/project/architecture', label: 'Arquitectura' },
  { path: '/project/api', label: 'API' },
  { path: '/project/team', label: 'Equipo' },
  { path: '/project/git', label: 'Git' },
]
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-[1800px] items-center gap-4 px-5 py-3 lg:gap-8 lg:px-8 xl:grid xl:grid-cols-[1fr_auto_1fr]">
        <div class="shrink-0">
          <RouterLink to="/project" class="text-lg font-bold tracking-tight text-slate-900">CS Préstamos</RouterLink>
          <p class="text-xs font-medium uppercase tracking-[0.18em] text-blue-700">Project Showcase</p>
        </div>
        <nav aria-label="Secciones del proyecto" class="flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto lg:justify-center">
          <RouterLink
            v-for="item in navigation"
            :key="item.path"
            :to="item.path"
            :active-class="item.exact ? '' : 'bg-blue-50 text-blue-800'"
            :exact-active-class="item.exact ? 'bg-blue-50 text-blue-800' : ''"
            class="shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
        <RouterLink to="/login" class="inline-flex shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-700 xl:justify-self-end xl:px-4">
          <span class="xl:hidden">Acceso</span>
          <span class="hidden xl:inline">Ver prototipo de acceso</span>
        </RouterLink>
      </div>
    </header>

    <main class="mx-auto px-5 py-10 lg:px-8" :class="route.path === '/project/architecture' ? 'max-w-[1600px]' : 'max-w-7xl'">
      <RouterView />
    </main>

  </div>
</template>
