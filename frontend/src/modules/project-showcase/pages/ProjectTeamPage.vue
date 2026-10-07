<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'

const { data: team, loading: teamLoading } = useGeneratedData(projectDocumentation.team)
const { data: weeks, loading: weeksLoading } = useGeneratedData(projectDocumentation.progress)
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Seguimiento</p>
    <h1 class="mt-2 text-3xl font-bold">Equipo</h1>
    <p class="mt-3 max-w-3xl text-slate-600">Responsabilidades del equipo y avances documentados del sprint. El seguimiento semanal se presenta por separado y no mide productividad individual.</p>

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
          </div>
          <p v-if="member.pending" class="mt-3 text-sm leading-6 text-slate-600"><strong class="text-slate-800">Pendiente:</strong> {{ member.pending }}</p>
        </article>
      </div>
    </section>

    <section class="mt-12">
      <h2 class="text-xl font-bold">Seguimiento semanal</h2>
      <p v-if="weeksLoading" class="mt-4 text-sm text-slate-500">Cargando avances…</p>
      <EmptyState v-else-if="!weeks?.length" class="mt-4" title="Sin semanas registradas" detail="Aún no hay registros semanales con fechas y avances verificados en docs/planning/progress/." />
      <div v-else class="mt-4 space-y-6">
        <article v-for="week in weeks" :key="week.week" class="rounded-2xl border border-slate-200 bg-white p-6">
          <p class="text-xs font-semibold uppercase tracking-widest text-blue-700">Sprint {{ week.sprint }} · {{ week.start }} — {{ week.end }}</p>
          <h2 class="mt-1 text-xl font-bold">Semana {{ week.week }}</h2>
          <p class="mt-1 text-xs text-slate-500">Estado: {{ week.status }} · Fuente: {{ week.source }}</p>
          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <section v-for="member in week.members" :key="member.name" class="rounded-xl bg-slate-50 p-4">
              <h3 class="font-semibold">{{ member.name }}</h3>
              <dl class="mt-3 space-y-2 text-sm text-slate-600">
                <div><dt class="font-medium text-slate-800">Planificado</dt><dd>{{ member.planned.join('; ') || 'Sin registro' }}</dd></div>
                <div><dt class="font-medium text-slate-800">Realizado</dt><dd>{{ member.done.join('; ') || 'Sin registro' }}</dd></div>
                <div><dt class="font-medium text-slate-800">Pendiente</dt><dd>{{ member.pending.join('; ') || 'Sin registro' }}</dd></div>
                <div><dt class="font-medium text-slate-800">Bloqueos</dt><dd>{{ member.blockers.join('; ') || 'Sin registro' }}</dd></div>
              </dl>
            </section>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>
