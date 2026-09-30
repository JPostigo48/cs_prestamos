<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'

const { data: api, loading } = useGeneratedData(projectDocumentation.openApi)
const endpoints = computed(() =>
  Object.entries(api.value?.paths ?? {}).flatMap(([path, operations]) =>
    Object.entries(operations)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(([method, operation]) => ({ path, method: method.toUpperCase(), ...operation })),
  ),
)
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Contratos del backend</p>
    <h1 class="mt-2 text-3xl font-bold">API</h1>
    <p class="mt-3 max-w-3xl text-slate-600">Esta vista utiliza OpenAPI como especificación estructurada. No es Swagger UI ni una lista de endpoints duplicada en Vue.</p>

    <p v-if="loading" class="mt-8 text-sm text-slate-500">Cargando especificación…</p>
    <EmptyState v-else-if="!endpoints.length" class="mt-8" title="OpenAPI aún no disponible" detail="La especificación deberá generarse desde los controllers y DTO reales de NestJS. Los contratos todavía pendientes no se presentan como implementados." />

    <div v-else class="mt-8 space-y-4">
      <article v-for="endpoint in endpoints" :key="`${endpoint.method}:${endpoint.path}`" class="rounded-2xl border border-slate-200 bg-white p-5">
        <div class="flex flex-wrap items-center gap-3">
          <span class="rounded-md bg-blue-100 px-2 py-1 font-mono text-xs font-bold text-blue-800">{{ endpoint.method }}</span>
          <code class="break-all text-sm font-semibold">{{ endpoint.path }}</code>
          <span v-for="tag in endpoint.tags ?? []" :key="tag" class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{{ tag }}</span>
        </div>
        <p class="mt-3 text-sm text-slate-700">{{ endpoint.summary || endpoint.description || 'Sin descripción en OpenAPI' }}</p>
        <div class="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <span v-if="endpoint.parameters?.length">Parámetros: {{ endpoint.parameters.map((parameter) => parameter.name).join(', ') }}</span>
          <span v-if="endpoint.requestBody">Cuerpo de solicitud documentado</span>
          <span v-if="endpoint.responses">Respuestas: {{ Object.keys(endpoint.responses).join(', ') }}</span>
        </div>
      </article>
    </div>
  </section>
</template>
