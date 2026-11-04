<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'

const { data: team, loading } = useGeneratedData(projectDocumentation.team)
const selectedMembers = ref<Record<number, string>>({ 1: 'JC', 2: 'JC' })
const phases = computed(() => [
  { id: 1, deliveries: ['task-01', 'task-02', 'task-03', 'exam-01'] },
  { id: 2, deliveries: ['task-04', 'task-05', 'task-06', 'exam-02'] },
].map((phase) => ({
  id: phase.id,
  milestones: team.value?.milestones.filter((milestone) => phase.deliveries.includes(milestone.id)) ?? [],
})))
</script>

<template>
  <section class="min-w-0">
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Avances académicos</p>
    <h1 class="mt-2 text-3xl font-bold">Equipo</h1>
    <p class="mt-3 text-slate-600">Cada tarea y examen representa un sprint académico.</p>

    <p v-if="loading" role="status" class="mt-8 text-sm text-slate-500">Cargando equipo…</p>
    <EmptyState v-else-if="!team?.milestones.length || !team.members.length" class="mt-8" title="Avances no disponibles" detail="No se pudo cargar la información del equipo. Recarga la página para volver a intentarlo." />

    <template v-else>
      <section v-for="phase in phases" :key="phase.id" class="mt-8" :aria-labelledby="`phase-${phase.id}-heading`">
        <h2 :id="`phase-${phase.id}-heading`" class="text-xl font-bold text-slate-900">Fase {{ phase.id }}</h2>
        <div class="team-scroll mt-4 rounded-xl border border-slate-200 bg-white" role="region" :aria-label="`Avances de la fase ${phase.id} por integrante y entrega`" tabindex="0">
        <table class="team-table w-full text-left text-sm">
          <caption class="sr-only">Avances del equipo por tarea y examen de la fase {{ phase.id }}. Un integrante ampliado a la vez.</caption>
          <colgroup>
            <col class="milestone-column">
            <col v-for="member in team.members" :key="member.initials" :class="member.initials === selectedMembers[phase.id] ? 'active-column' : 'collapsed-column'">
          </colgroup>
          <thead>
            <tr class="bg-slate-100">
              <th scope="col" class="p-3 font-semibold">Sprint</th>
              <th v-for="member in team.members" :key="member.initials" scope="col" class="member-heading p-2" :class="{ 'selected-cell': member.initials === selectedMembers[phase.id] }">
                <button
                  type="button"
                  class="member-button w-full rounded-lg py-3 font-semibold text-blue-900 hover:bg-blue-100"
                  :aria-label="member.name"
                  :aria-pressed="member.initials === selectedMembers[phase.id]"
                  @click="selectedMembers[phase.id] = member.initials"
                >
                  {{ member.initials === selectedMembers[phase.id] ? member.name : member.initials }}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="milestone in phase.milestones" :key="milestone.id" class="border-t border-slate-200" :class="{ 'exam-row': milestone.kind === 'exam', 'current-row': milestone.status === 'in_progress' }">
              <th scope="row" class="p-3 align-top font-normal">
                <span class="block font-bold text-slate-900">{{ milestone.title }}</span>
                <span class="mt-1 block text-xs text-slate-600">{{ milestone.date ?? 'Sin fecha documental' }}</span>
                <span v-if="milestone.status === 'in_progress'" class="mt-2 inline-block rounded-full bg-blue-800 px-2 py-1 text-xs font-semibold text-white">Presente · En curso</span>
                <p class="mt-2 text-xs leading-5 text-slate-600">{{ milestone.outcome }}</p>
              </th>
              <td v-for="member in team.members" :key="member.initials" class="align-top" :class="{ 'selected-cell': member.initials === selectedMembers[phase.id] }">
                <ul v-if="member.initials === selectedMembers[phase.id]" class="list-disc space-y-2 py-4 pl-7 pr-4 leading-6 text-slate-700">
                  <li v-for="point in milestone.progress[member.initials]" :key="point">{{ point }}</li>
                </ul>
                <span v-else class="sr-only">Columna contraída. Selecciona {{ member.name }} en la cabecera para consultar sus avances.</span>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </section>
      <section class="mt-8" aria-labelledby="phase-3-heading">
        <h2 id="phase-3-heading" class="text-xl font-bold text-slate-900">Fase 3</h2>
        <p class="mt-3 text-slate-600">Pendiente</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.team-scroll { max-width: 100%; overflow-x: auto; overscroll-behavior-x: contain; }
.team-table { min-width: 59rem; table-layout: fixed; }
.milestone-column { width: 30rem; }
.collapsed-column { width: 3.5rem; }
.member-heading { vertical-align: middle; }
.selected-cell { background: #eff6ff; }
.exam-row > th { background: #e0f2fe; border-left: 4px solid #38bdf8; }
.current-row > th { background: #dbeafe; border-left-color: #1d4ed8; }
.member-button:focus-visible, .team-scroll:focus-visible { outline: 3px solid #2563eb; outline-offset: -3px; }
</style>
