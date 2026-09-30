<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'

const { data: workflow, loading } = useGeneratedData(projectDocumentation.git)
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Colaboración</p>
    <h1 class="mt-2 text-3xl font-bold">Flujo Git</h1>
    <p class="mt-3 max-w-3xl text-slate-600">Las ramas temporales parten de develop y regresan mediante Pull Request. Una rama existente no demuestra que su tarea esté terminada.</p>

    <p v-if="loading" class="mt-8 text-sm text-slate-500">Cargando convenciones…</p>
    <EmptyState v-else-if="!workflow" class="mt-8" title="Flujo no generado" detail="La fuente de esta vista es docs/planning/git-workflow.md." />

    <div v-else class="mt-8 space-y-8">
      <div class="grid gap-3 text-center text-sm font-semibold text-slate-700 sm:grid-cols-5">
        <div v-for="stage in ['Rama temporal', 'Pull Request', 'develop', 'main', 'tag']" :key="stage" class="rounded-xl border border-blue-100 bg-blue-50 px-3 py-4">{{ stage }}</div>
      </div>

      <section class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-lg font-bold">Ramas temporales</h2>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="branch in workflow.branchTypes" :key="branch.prefix" class="rounded-xl bg-slate-50 p-4">
            <code class="font-semibold text-blue-800">{{ branch.prefix }}</code>
            <p class="mt-1 text-sm text-slate-600">{{ branch.purpose }}</p>
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-lg font-bold">Versión objetivo y prefijo de commit</h2>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[520px] text-left text-sm">
            <thead class="border-b border-slate-200 text-slate-500"><tr><th class="pb-3">Sprint</th><th class="pb-3">Versión</th><th class="pb-3">Prefijo</th></tr></thead>
            <tbody><tr v-for="version in workflow.versions" :key="version.sprint" class="border-b border-slate-100"><td class="py-3">{{ version.sprint }}</td><td>{{ version.version }}</td><td><code>{{ version.prefix }}</code></td></tr></tbody>
          </table>
        </div>
        <p class="mt-4 text-xs text-slate-500">Fuente: {{ workflow.source }}. Pull Requests y tags se muestran como realizados solo cuando exista evidencia documentada.</p>
      </section>
    </div>
  </section>
</template>
