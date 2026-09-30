<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'

const { data: architecture, loading } = useGeneratedData(projectDocumentation.architecture)
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Diseño del sistema</p>
    <h1 class="mt-2 text-3xl font-bold">Arquitectura</h1>
    <p class="mt-3 max-w-3xl text-slate-600">Los SVG son exportaciones para consulta. Los archivos PlantUML y Structurizr siguen siendo las fuentes editables.</p>

    <p v-if="loading" class="mt-8 text-sm text-slate-500">Cargando diagramas…</p>
    <EmptyState v-else-if="!architecture?.diagrams.length" class="mt-8" title="Diagramas no generados" detail="Genera los SVG a partir de docs/architecture/uml/ y vuelve a cargar esta página." />

    <div v-else class="mt-8 space-y-8">
      <article v-for="diagram in architecture.diagrams" :key="diagram.source" class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <span class="text-xs font-semibold uppercase tracking-widest text-blue-700">{{ diagram.type }}</span>
            <h2 class="mt-1 text-lg font-bold">{{ diagram.title }}</h2>
            <p class="mt-1 text-xs text-slate-500">Fuente: {{ diagram.source }}</p>
          </div>
          <a v-if="diagram.image" :href="diagram.image" target="_blank" rel="noopener noreferrer" class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:border-blue-500 hover:text-blue-700">Abrir SVG ↗</a>
        </div>
        <div v-if="diagram.image" class="overflow-auto bg-slate-50 p-4">
          <img :src="diagram.image" :alt="diagram.title" class="mx-auto h-auto min-w-[640px] max-w-none" />
        </div>
        <p v-else class="p-5 text-sm text-slate-600">Esta vista todavía no tiene una exportación SVG disponible.</p>
      </article>

      <div class="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
        Las vistas de contextos delimitados permanecen en <code>{{ architecture.structurizr }}</code>. Su exportación SVG automatizada requiere un mecanismo de navegador documentado; no se sustituye por un dibujo manual.
      </div>
    </div>
  </section>
</template>
