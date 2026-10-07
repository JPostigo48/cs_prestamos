<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'

const { data: team, loading: teamLoading } = useGeneratedData(projectDocumentation.team)
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Sprint en curso</p>
    <h1 class="mt-2 text-3xl font-bold">Equipo</h1>
    <p class="mt-3 max-w-3xl text-slate-600">Responsabilidades, avances y pendientes registrados por integrante en la planificación del sprint.</p>

    <p v-if="teamLoading" class="mt-8 text-sm text-slate-500">Cargando equipo…</p>
    <EmptyState v-else-if="!team?.members.length" class="mt-8" title="Equipo no generado" detail="La información del equipo se documenta en docs/planning/README.md." />
    <section v-else class="mt-8">
      <h2 class="text-xl font-bold">Integrantes y responsabilidades</h2>
      <p class="mt-1 text-sm text-slate-500">Fuente: {{ team.source }}<span v-if="team.progressSource"> · Avances: {{ team.progressSource }}</span></p>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <article v-for="member in team.members" :key="member.name" class="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 class="text-lg font-semibold text-slate-900">{{ member.name }}</h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">{{ member.responsibility }}</p>
          <p class="mt-2 text-xs text-slate-500">Área: {{ member.area }}</p>
          <div v-if="member.update" class="mt-4 border-t border-slate-100 pt-4 text-sm">
            <p class="font-semibold text-slate-800">Avance registrado<span v-if="team.sprint !== null"> · Sprint {{ team.sprint }}</span></p>
            <p class="mt-1 leading-6 text-slate-600">{{ member.update }}</p>
            <a v-if="member.evidence" :href="member.evidence.url" target="_blank" rel="noopener noreferrer" class="mt-2 inline-block font-medium text-blue-700 hover:underline">{{ member.evidence.label }} ↗</a>
          </div>
          <p v-if="member.pending" class="mt-3 text-sm leading-6 text-slate-600"><strong class="text-slate-800">Pendiente:</strong> {{ member.pending }}</p>
        </article>
      </div>
    </section>
  </section>
</template>
