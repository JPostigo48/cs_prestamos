<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'
import type { OpenApiOperation, OpenApiSchema } from '../types'

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
        status: operation['x-implementation-status'] === 'implemented' ? 'implemented' : 'pending',
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

function resolveSchema(schema?: OpenApiSchema): OpenApiSchema | undefined {
  if (!schema?.$ref) return schema
  const name = schema.$ref.split('/').at(-1)
  return name ? api.value?.components?.schemas?.[name] : undefined
}

function schemaLabel(schema?: OpenApiSchema): string {
  if (!schema) return 'sin tipo especificado'
  if (schema.enum?.length) return schema.enum.join(' | ')
  if (schema.type === 'array') return `${schemaLabel(schema.items)}[]`
  return schema.format ? `${schema.type ?? 'string'} (${schema.format})` : schema.type ?? 'sin tipo especificado'
}

function requestFields(endpoint: Endpoint) {
  const schema = resolveSchema(endpoint.requestBody?.content?.['application/json']?.schema)
  return Object.entries(schema?.properties ?? {}).map(([name, property]) => ({
    name,
    type: schemaLabel(property),
    required: schema?.required?.includes(name) ?? false,
  }))
}

function exampleFromSchema(schema?: OpenApiSchema): unknown {
  if (!schema) return undefined
  if (schema.example !== undefined) return schema.example
  if (schema.$ref) return exampleFromSchema(resolveSchema(schema))
  if (schema.allOf?.length) {
    return Object.assign({}, ...schema.allOf.map((part) => exampleFromSchema(part)))
  }
  if (schema.enum?.length) return schema.enum[0]
  if (schema.type === 'array') {
    const item = exampleFromSchema(schema.items)
    return item === undefined ? [] : [item]
  }
  if (schema.type === 'object' || schema.properties) {
    return Object.fromEntries(
      Object.entries(schema.properties ?? {})
        .map(([name, property]) => [name, exampleFromSchema(property)])
        .filter(([, value]) => value !== undefined),
    )
  }
  if (schema.format === 'uuid') return '550e8400-e29b-41d4-a716-446655440000'
  if (schema.format === 'date-time') return '2026-10-06T10:00:00.000Z'
  if (schema.format === 'email') return 'usuario@ejemplo.com'
  if (schema.format === 'password') return 'ClaveEjemplo123'
  if (schema.type === 'string') return 'Texto de ejemplo'
  if (schema.type === 'integer' || schema.type === 'number') return 1
  if (schema.type === 'boolean') return true
  return undefined
}

function mediaExample(content?: Record<string, { schema?: OpenApiSchema; example?: unknown; examples?: Record<string, { value?: unknown }> }>) {
  if (!content) return undefined
  const entry = content['application/json']
    ? ['application/json', content['application/json']] as const
    : Object.entries(content)[0]
  if (!entry) return undefined
  const [mediaType, media] = entry
  const value = media.example
    ?? Object.values(media.examples ?? {}).find((example) => example.value !== undefined)?.value
    ?? exampleFromSchema(media.schema)
  return value === undefined ? undefined : {
    mediaType,
    body: mediaType === 'application/json' ? JSON.stringify(value, null, 2) : String(value),
  }
}

function responseExamples(endpoint: Endpoint) {
  return Object.entries(endpoint.responses ?? {}).flatMap(([status, response]) => {
    const example = mediaExample(response.content)
    return example ? [{ status, ...example }] : []
  })
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
              <span :class="endpoint.status === 'implemented' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'" class="rounded-full px-3 py-1 text-xs font-medium">
                {{ endpoint.status === 'implemented' ? 'Implementado en código' : 'Pendiente' }}
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
                <div v-if="mediaExample(endpoint.requestBody.content)" class="mt-3">
                  <p class="font-medium text-slate-900">JSON de envío ilustrativo</p>
                  <pre class="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100"><code>{{ mediaExample(endpoint.requestBody.content)?.body }}</code></pre>
                </div>
              </div>

              <p v-if="endpoint.responses">Códigos de respuesta declarados: {{ Object.keys(endpoint.responses).join(', ') }}</p>
              <div v-for="example in responseExamples(endpoint)" :key="`${example.status}:${example.mediaType}`">
                <p class="font-medium text-slate-900">Respuesta {{ example.status }} · ejemplo ilustrativo ({{ example.mediaType }})</p>
                <pre class="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100"><code>{{ example.body }}</code></pre>
              </div>
              <p v-if="endpoint.responses && !responseExamples(endpoint).length" class="text-slate-500">
                La forma de la respuesta aún no está documentada.
              </p>
            </div>
          </details>
        </div>
      </div>
    </template>
  </section>
</template>
