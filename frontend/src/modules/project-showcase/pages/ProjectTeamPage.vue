<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'

const { data: team, loading } = useGeneratedData(projectDocumentation.team)
const selectedSprintNumber = ref<number | null>(null)

const selectedSprint = computed(() => {
  const sprints = team.value?.sprints ?? []
  return sprints.find((sprint) => sprint.sprint === selectedSprintNumber.value)
    ?? sprints.find((sprint) => sprint.sprint === team.value?.currentSprint)
    ?? sprints.at(-1)
    ?? null
})

const hasIndividualProgress = computed(() =>
  selectedSprint.value?.members.some((member) => member.update) ?? false,
)

function selectSprint(event: Event) {
  selectedSprintNumber.value = Number((event.target as HTMLSelectElement).value)
}

function statusLabel(status: string) {
  if (status === 'planned') return 'Planificado'
  if (status === 'completed') return 'Finalizado'
  return 'En curso'
}
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Planificación del equipo</p>
    <h1 class="mt-2 text-3xl font-bold">Equipo</h1>
    <p class="mt-3 max-w-3xl text-slate-600">Responsabilidades, avances y pendientes registrados por integrante en cada sprint.</p>

    <p v-if="loading" class="mt-8 text-sm text-slate-500">Cargando equipo…</p>
    <EmptyState v-else-if="!team?.sprints.length" class="mt-8" title="Equipo no generado" detail="La información del equipo se documenta en docs/planning/." />

    <div v-else class="mt-8">
      <label for="team-sprint" class="block text-sm font-semibold text-slate-800">Seleccionar sprint</label>
      <select
        id="team-sprint"
        :value="selectedSprint?.sprint ?? ''"
        class="mt-2 w-full max-w-sm rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
        @change="selectSprint"
      >
        <option v-for="sprint in team.sprints" :key="sprint.sprint" :value="sprint.sprint">
          Sprint {{ sprint.sprint }}{{ sprint.sprint === team.currentSprint ? ' (actual)' : '' }}
        </option>
      </select>

      <section v-if="selectedSprint" class="mt-8">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-xl font-bold">Sprint {{ selectedSprint.sprint }} — {{ selectedSprint.name }}</h2>
          <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
            {{ selectedSprint.sprint === team.currentSprint ? 'Actual' : statusLabel(selectedSprint.status) }}
          </span>
        </div>
        <p class="mt-2 text-xs text-slate-500">Fuentes: {{ team.source }} · {{ selectedSprint.source }}</p>
        <p v-if="!hasIndividualProgress" class="mt-4 text-sm text-slate-600">
          {{ selectedSprint.status === 'planned'
            ? 'Este sprint está planificado; todavía no hay avances por integrante.'
            : 'Este sprint no tiene avances individuales registrados.' }}
        </p>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <article v-for="member in selectedSprint.members" :key="member.name" class="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 class="text-lg font-semibold text-slate-900">{{ member.name }}</h3>
            <p class="mt-2 text-sm leading-6 text-slate-600">{{ member.responsibility }}</p>
            <p class="mt-2 text-xs text-slate-500">Área: {{ member.area }}</p>
            <div v-if="member.update" class="mt-4 border-t border-slate-100 pt-4 text-sm">
              <p class="font-semibold text-slate-800">Avance registrado</p>
              <p class="mt-1 leading-6 text-slate-600">{{ member.update }}</p>
              <a v-if="member.evidence" :href="member.evidence.url" target="_blank" rel="noopener noreferrer" class="mt-2 inline-block font-medium text-blue-700 hover:underline">{{ member.evidence.label }} ↗</a>
            </div>
            <p v-if="member.pending" class="mt-3 text-sm leading-6 text-slate-600"><strong class="text-slate-800">Pendiente:</strong> {{ member.pending }}</p>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
