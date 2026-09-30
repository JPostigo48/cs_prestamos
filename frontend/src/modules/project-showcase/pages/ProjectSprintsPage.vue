<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'

const { data: planning, loading } = useGeneratedData(projectDocumentation.planning)
const { data: backlog } = useGeneratedData(projectDocumentation.backlog)
const sprints = computed(() => planning.value?.sprints ?? [])

function plannedItems(number: number) {
  return backlog.value?.filter((item) => item.sprint.split(',').map((part) => part.trim()).includes(String(number))) ?? []
}
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Planificación</p>
    <h1 class="mt-2 text-3xl font-bold">Sprints</h1>
    <p class="mt-3 max-w-3xl text-slate-600">Las versiones son objetivos de planificación. Una tarea no se considera realizada por aparecer en este listado.</p>

    <p v-if="loading" class="mt-8 text-sm text-slate-500">Cargando sprints…</p>
    <EmptyState v-else-if="!sprints.length" class="mt-8" title="Planificación no generada" detail="Ejecuta el generador de Project Showcase para publicar los datos de docs/planning/." />

    <div v-else class="mt-8 space-y-6">
      <article v-for="sprint in sprints" :key="sprint.sprint" class="rounded-2xl border border-slate-200 bg-white p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-blue-700">Sprint {{ sprint.sprint }} · {{ sprint.version }}</p>
            <h2 class="mt-1 text-xl font-bold">{{ sprint.name }}</h2>
          </div>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{{ sprint.status }}</span>
        </div>
        <p class="mt-4 text-sm leading-6 text-slate-600">{{ sprint.objective || 'Objetivo documentado en el archivo del sprint.' }}</p>

        <div class="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 class="text-sm font-semibold">Responsables</h3>
            <ul class="mt-2 space-y-2 text-sm text-slate-600">
              <li v-for="member in sprint.members" :key="member.name"><strong class="text-slate-800">{{ member.name }}</strong> · {{ member.responsibility }}</li>
            </ul>
          </div>
          <div>
            <h3 class="text-sm font-semibold">Backlog planificado</h3>
            <details v-if="plannedItems(sprint.sprint).length" class="mt-2 text-sm text-slate-600">
              <summary class="cursor-pointer font-medium text-blue-700">Ver {{ plannedItems(sprint.sprint).length }} tareas</summary>
              <ul class="mt-3 max-h-80 space-y-2 overflow-y-auto pr-2">
                <li v-for="item in plannedItems(sprint.sprint)" :key="item.id"><strong class="text-slate-800">{{ item.id }}</strong> · {{ item.description }} <span class="text-xs text-slate-400">{{ item.module }} · {{ item.status }}</span></li>
              </ul>
            </details>
            <p v-else class="mt-2 text-sm text-slate-500">Sin tareas asignadas en el backlog disponible.</p>
          </div>
        </div>
        <p class="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">Resultado registrado: {{ sprint.result || 'Pendiente de cierre' }} · Fuente: {{ sprint.source }}</p>
      </article>
    </div>
  </section>
</template>
