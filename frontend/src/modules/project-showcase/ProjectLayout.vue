<script setup lang="ts">
const navigation = [
  { path: '/project', label: 'Resumen', exact: true },
  { path: '/project/sprints', label: 'Sprints' },
  { path: '/project/architecture', label: 'Arquitectura' },
  { path: '/project/api', label: 'API' },
  { path: '/project/data', label: 'Datos' },
  { path: '/project/team', label: 'Equipo' },
  { path: '/project/git', label: 'Git' },
]
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-8">
        <div>
          <RouterLink to="/project" class="text-lg font-bold tracking-tight text-slate-900">CS Préstamos</RouterLink>
          <p class="text-xs font-medium uppercase tracking-[0.18em] text-blue-700">Project Showcase</p>
        </div>
        <RouterLink to="/login" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-700">
          Ver prototipo de acceso
        </RouterLink>
      </div>
      <nav aria-label="Secciones del proyecto" class="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 lg:px-7">
        <RouterLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          :active-class="item.exact ? '' : 'bg-blue-50 text-blue-800'"
          :exact-active-class="item.exact ? 'bg-blue-50 text-blue-800' : ''"
          class="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </header>

    <main class="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <RouterView />
    </main>

    <footer class="mt-16 border-t border-slate-200 bg-white px-5 py-6 text-center text-xs text-slate-500">
      Los documentos y modelos versionados siguen siendo la fuente de verdad. Esta sección muestra artefactos derivados.
    </footer>
  </div>
</template>
