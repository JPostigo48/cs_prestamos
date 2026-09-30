<script setup lang="ts">
import { computed } from 'vue'
import { projectDocumentation } from '../services/projectDocumentation'
import { useGeneratedData } from '../composables/useGeneratedData'

const { data: planning, loading } = useGeneratedData(projectDocumentation.planning)
const currentSprint = computed(() => planning.value?.sprints.filter((sprint) => sprint.status === 'in_progress').at(-1))

const sections = [
  { path: '/project/sprints', title: 'Sprints', detail: 'Planificación, responsables y resultados documentados.' },
  { path: '/project/architecture', title: 'Arquitectura', detail: 'Diagramas UML exportados desde sus fuentes.' },
  { path: '/project/api', title: 'API', detail: 'Endpoints descritos por OpenAPI cuando esté disponible.' },
  { path: '/project/data', title: 'Datos', detail: 'Dominio, persistencia y arquitectura sin confundir sus modelos.' },
  { path: '/project/team', title: 'Equipo', detail: 'Seguimiento semanal basado en registros verificables.' },
  { path: '/project/git', title: 'Git', detail: 'Ramas, versiones y flujo de integración del proyecto.' },
]
</script>

<template>
  <div>
    <div class="max-w-3xl">
      <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Desarrollo del proyecto</p>
      <h1 class="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">{{ planning?.project || 'Sistema de gestión de préstamos universitarios' }}</h1>
      <p class="mt-5 text-base leading-7 text-slate-600">Una vista del proceso de construcción del sistema. El diseño y la planificación se muestran por separado de las funcionalidades de préstamos.</p>
    </div>

    <div v-if="loading" class="mt-8 text-sm text-slate-500">Cargando planificación…</div>
    <div v-else class="mt-8 grid gap-4 sm:grid-cols-3">
      <div class="rounded-2xl border border-slate-200 bg-white p-5">
        <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Sprint en curso</p>
        <p class="mt-2 text-xl font-bold">{{ currentSprint ? `Sprint ${currentSprint.sprint}` : 'Sin registro' }}</p>
        <p class="mt-1 text-sm text-slate-600">{{ currentSprint?.name || 'Consultar la planificación versionada.' }}</p>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-5">
        <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Versión objetivo</p>
        <p class="mt-2 text-xl font-bold">{{ currentSprint?.version || 'Por definir' }}</p>
        <p class="mt-1 text-sm text-slate-600">No equivale a una versión publicada.</p>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-5">
        <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Fuente</p>
        <p class="mt-2 text-xl font-bold">docs/planning</p>
        <p class="mt-1 text-sm text-slate-600">Contenido derivado de Markdown versionado.</p>
      </div>
    </div>

    <section v-if="planning?.technologies.length" class="mt-12">
      <h2 class="text-xl font-bold">Tecnologías documentadas</h2>
      <div class="mt-4 flex flex-wrap gap-2">
        <span v-for="item in planning.technologies" :key="item.area" class="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm text-blue-900">
          <strong>{{ item.area }}:</strong> {{ item.technology }}
        </span>
      </div>
    </section>

    <section class="mt-12">
      <h2 class="text-xl font-bold">Explorar el proyecto</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink v-for="section in sections" :key="section.path" :to="section.path" class="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
          <h3 class="font-semibold text-slate-900 group-hover:text-blue-800">{{ section.title }} <span aria-hidden="true">↗</span></h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">{{ section.detail }}</p>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
