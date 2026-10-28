<script setup lang="ts">
import { computed, ref } from 'vue'
import AccessBadge from '../components/AccessBadge.vue'
import { schemaPresenter } from '../services/openApiPresentation'
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'
import type { OpenApiOperation } from '../types'

type ImplementationStatus = 'implemented' | 'pending'
type Endpoint = OpenApiOperation & {
  path: string
  method: string
  module: string
  status: ImplementationStatus
}

const { data: api, loading } = useGeneratedData(projectDocumentation.openApi)
const search = ref('')
const selectedModule = ref('all')
const selectedStatus = ref<'all' | ImplementationStatus>('all')

const endpoints = computed<Endpoint[]>(() =>
  Object.entries(api.value?.paths ?? {}).flatMap(([path, operations]) =>
    Object.entries(operations)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(([method, operation]) => ({
        ...operation,
        path,
        method: method.toUpperCase(),
        module: operation.tags?.[0] ?? 'Sin módulo',
        status: operation['x-implementation-status'] === 'pending' ? 'pending' : 'implemented',
      })),
  ),
)

const modules = computed(() => [...new Set(endpoints.value.map((endpoint) => endpoint.module))].sort())
const implementedCount = computed(() => endpoints.value.filter((endpoint) => endpoint.status === 'implemented').length)
const pendingCount = computed(() => endpoints.value.length - implementedCount.value)

const visibleEndpoints = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return endpoints.value.filter((endpoint) =>
    (selectedModule.value === 'all' || endpoint.module === selectedModule.value)
    && (selectedStatus.value === 'all' || endpoint.status === selectedStatus.value)
    && (!query || `${endpoint.method} ${endpoint.path} ${endpoint.summary ?? ''}`.toLocaleLowerCase().includes(query)),
  )
})

const groups = computed(() => modules.value
  .map((module) => ({ module, endpoints: visibleEndpoints.value.filter((endpoint) => endpoint.module === module) }))
  .filter((group) => group.endpoints.length > 0))

const { resolveSchema, schemaLabel, mediaExamples, responseExamples } = schemaPresenter(() => api.value)
function requestFields(endpoint: Endpoint) {
  const schema = resolveSchema(endpoint.requestBody?.content?.['application/json']?.schema)
  return Object.entries(schema?.properties ?? {}).map(([name, property]) => ({ name, type: schemaLabel(property), required: schema?.required?.includes(name) ?? false }))
}
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Contratos del backend</p>
    <h1 class="mt-2 text-3xl font-bold">API</h1>
    <p class="mt-3 max-w-4xl text-slate-600">
      Endpoints declarados en los controladores de NestJS. «Implementado en código» indica que la operación tiene lógica desarrollada; no sustituye una prueba de integración.
    </p>

    <p v-if="loading" class="mt-8 text-sm text-slate-500">Cargando especificación…</p>
    <EmptyState
      v-else-if="!endpoints.length"
      class="mt-8"
      title="OpenAPI aún no disponible"
      detail="Genera la especificación desde el backend con npm run project:generate. No se muestra una lista manual de rutas."
    />

    <template v-else>
      <div class="mt-7 flex flex-wrap gap-3 text-sm">
        <span class="rounded-full bg-slate-100 px-4 py-2 text-slate-700">{{ endpoints.length }} endpoints</span>
        <span class="rounded-full bg-emerald-100 px-4 py-2 text-emerald-800">{{ implementedCount }} implementados en código</span>
        <span class="rounded-full bg-amber-100 px-4 py-2 text-amber-800">{{ pendingCount }} pendientes</span>
      </div>

      <div class="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <input v-model="search" type="search" placeholder="Buscar método o ruta" aria-label="Buscar endpoints" class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm">
        <select v-model="selectedModule" aria-label="Filtrar por módulo" class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm">
          <option value="all">Todos los módulos</option>
          <option v-for="module in modules" :key="module" :value="module">{{ module }}</option>
        </select>
        <select v-model="selectedStatus" aria-label="Filtrar por estado" class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm">
          <option value="all">Todos los estados</option>
          <option value="implemented">Implementados</option>
          <option value="pending">Pendientes</option>
        </select>
      </div>

      <p v-if="!visibleEndpoints.length" class="mt-8 text-sm text-slate-500">No hay endpoints que coincidan con los filtros.</p>

      <div v-for="group in groups" :key="group.module" class="mt-9">
        <h2 class="mb-4 text-xl font-semibold text-slate-900">{{ group.module }}</h2>
        <div class="space-y-3">
          <details v-for="endpoint in group.endpoints" :key="`${endpoint.method}:${endpoint.path}`" class="rounded-2xl border border-slate-200 bg-white p-5">
            <summary class="flex cursor-pointer list-none flex-wrap items-center gap-3">
              <span class="rounded-md bg-blue-100 px-2 py-1 font-mono text-xs font-bold text-blue-800">{{ endpoint.method }}</span>
              <code class="min-w-0 flex-1 break-all text-sm font-semibold text-slate-900">{{ endpoint.path }}</code>
              <span class="inline-flex max-w-full items-center gap-2">
              <span :class="endpoint.status === 'implemented' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'" class="rounded-full px-3 py-1 text-xs font-medium">
                {{ endpoint.status === 'implemented' ? 'Implementado en código' : 'Pendiente' }}
              </span>
              <AccessBadge :operation="endpoint" />
              </span>
            </summary>

            <div class="mt-5 space-y-4 border-t border-slate-100 pt-4 text-sm text-slate-700">
              <p>{{ endpoint.summary || endpoint.description || 'Operación declarada en el controlador.' }}</p>

              <div v-if="endpoint.parameters?.length">
                <h3 class="font-semibold text-slate-900">Parámetros</h3>
                <ul class="mt-1 space-y-1">
                  <li v-for="parameter in endpoint.parameters" :key="`${parameter.in}:${parameter.name}`">
                    <code>{{ parameter.name }}</code> · {{ parameter.in }} · {{ parameter.required ? 'obligatorio' : 'opcional' }} · {{ schemaLabel(parameter.schema) }}
                  </li>
                </ul>
              </div>

              <div v-if="endpoint.requestBody">
                <h3 class="font-semibold text-slate-900">Cuerpo de la solicitud</h3>
                <ul v-if="requestFields(endpoint).length" class="mt-1 space-y-1">
                  <li v-for="field in requestFields(endpoint)" :key="field.name">
                    <code>{{ field.name }}</code> · {{ field.type }} · {{ field.required ? 'obligatorio' : 'opcional' }}
                  </li>
                </ul>
                <p v-else class="mt-1 text-slate-500">Esquema no especificado.</p>
                <div v-if="mediaExamples(endpoint.requestBody.content)[0]" class="mt-3">
                  <p class="font-medium text-slate-900">JSON de envío orientativo · sustituye los datos antes de enviarlo</p>
                  <pre class="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100"><code>{{ mediaExamples(endpoint.requestBody.content)[0]?.body }}</code></pre>
                </div>
              </div>

              <p v-if="endpoint.responses">Códigos de respuesta declarados: {{ Object.keys(endpoint.responses).join(', ') }}</p>
              <div v-for="example in responseExamples(endpoint)" :key="`${example.status}:${example.mediaType}`">
                <p class="font-medium text-slate-900">Respuesta {{ example.status }}<span v-if="example.mediaType"> · {{ example.mediaType }}</span></p>
                <p v-if="example.description">{{ example.description }}</p>
                <p v-if="example.noBody" class="text-slate-500">Sin cuerpo de respuesta.</p>
                <template v-else>
                  <p v-if="example.body !== undefined" class="mt-2">Ejemplo ilustrativo, no datos reales:</p>
                  <pre v-if="example.body !== undefined" class="mt-2 max-w-full overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100"><code>{{ example.body }}</code></pre>
                  <details v-if="example.schema" class="mt-2">
                    <summary class="cursor-pointer font-medium">Esquema de respuesta (incluye referencias y campos anidados)</summary>
                    <pre class="mt-2 max-w-full overflow-x-auto rounded-lg bg-slate-100 p-4 text-xs"><code>{{ example.schema }}</code></pre>
                  </details>
                  <p v-else class="text-slate-500">Este medio no declara un esquema.</p>
                </template>
              </div>
            </div>
          </details>
        </div>
      </div>
    </template>
  </section>
</template>
