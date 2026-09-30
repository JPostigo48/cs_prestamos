<script setup lang="ts">
import { ref } from 'vue'
import DiagramLightbox from '../components/DiagramLightbox.vue'
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'
import type { Diagram } from '../types'

const { data: architecture, loading } = useGeneratedData(projectDocumentation.architecture)
const selectedDiagram = ref<Diagram | null>(null)
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Diseño del sistema</p>
    <h1 class="mt-2 text-3xl font-bold">Arquitectura</h1>
    <p class="mt-3 w-full text-slate-600">Los SVG son exportaciones para consulta. Los archivos PlantUML y Structurizr siguen siendo las fuentes editables.</p>

    <p v-if="loading" class="mt-8 text-sm text-slate-500">Cargando diagramas…</p>
    <EmptyState v-else-if="!architecture?.diagrams.length" class="mt-8" title="Diagramas no generados" detail="Genera los SVG a partir de docs/architecture/uml/ y vuelve a cargar esta página." />

    <div v-else class="mt-8">
      <div class="flex flex-wrap gap-6">
        <article v-for="diagram in architecture.diagrams" :key="diagram.source" class="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white md:w-[calc(50%-0.75rem)] xl:w-[25vw]">
          <div class="min-h-36 border-b border-slate-100 p-5">
            <span class="text-xs font-semibold uppercase tracking-widest text-blue-700">{{ diagram.type }}</span>
            <h2 class="mt-1 text-lg font-bold">{{ diagram.title }}</h2>
            <p class="mt-1 break-all text-xs text-slate-500">Fuente: {{ diagram.source }}</p>
          </div>
          <button v-if="diagram.image" type="button" :aria-label="`Ampliar ${diagram.title}`" class="h-[40vh] w-full cursor-zoom-in bg-slate-50 p-4 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600" @click="selectedDiagram = diagram">
            <img :src="diagram.image" :alt="diagram.title" loading="lazy" class="h-full w-full object-contain" />
          </button>
          <p v-else class="flex h-[40vh] items-center p-5 text-sm text-slate-600">Esta vista todavía no tiene una exportación SVG disponible.</p>
          <div v-if="diagram.image" class="border-t border-slate-100 p-4">
            <a :href="diagram.image" target="_blank" rel="noopener noreferrer" class="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:border-blue-500 hover:text-blue-700">Abrir SVG ↗</a>
          </div>
        </article>
      </div>

      <div class="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
        Las vistas de contextos delimitados permanecen en <code>{{ architecture.structurizr }}</code>. Su exportación SVG automatizada requiere un mecanismo de navegador documentado; no se sustituye por un dibujo manual.
      </div>
    </div>
    <DiagramLightbox v-if="selectedDiagram?.image" :src="selectedDiagram.image" :title="selectedDiagram.title" @close="selectedDiagram = null" />
  </section>
</template>
