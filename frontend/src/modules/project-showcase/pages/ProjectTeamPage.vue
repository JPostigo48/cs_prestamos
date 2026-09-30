<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'

const { data: weeks, loading } = useGeneratedData(projectDocumentation.progress)
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Seguimiento</p>
    <h1 class="mt-2 text-3xl font-bold">Equipo</h1>
    <p class="mt-3 max-w-3xl text-slate-600">Los registros semanales muestran planificado, realizado, pendiente y bloqueos. No se usan para medir productividad individual.</p>

    <p v-if="loading" class="mt-8 text-sm text-slate-500">Cargando avances…</p>
    <EmptyState v-else-if="!weeks?.length" class="mt-8" title="Sin semanas registradas" detail="docs/planning/progress/ define el formato, pero aún no hay semanas con avances verificables. La vista no inventa historial." />

    <div v-else class="mt-8 space-y-6">
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
</template>
