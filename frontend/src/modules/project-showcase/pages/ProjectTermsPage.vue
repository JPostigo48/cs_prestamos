<script setup lang="ts">
import { computed } from 'vue'
import { useRemote } from '../../../shared/composables/useRemote'
import { readCurrentTerms } from '../services/termsApi'
import { confidenceLabel, criteriaDetails, policyFamilies, policyLabel, publicationLabel, suspensionLabel, termsSections } from '../services/termsPresentation'

const { data: terms, error, status, loading, refresh } = useRemote(readCurrentTerms)
const families = computed(() => policyFamilies.map(family => ({ ...family, policies: terms.value?.policies.filter(policy => policy.kind === family.kind) ?? [] })).filter(family => family.policies.length))
const sections = computed(() => termsSections(terms.value?.content ?? null))
</script>

<template>
  <section aria-labelledby="terms-heading" class="space-y-6">
    <header>
      <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Políticas públicas · base de datos</p>
      <h1 id="terms-heading" class="mt-2 text-3xl font-bold">Términos y condiciones</h1>
      <p class="mt-3 max-w-4xl text-slate-600">Consulta de la versión publicada por el backend. Esta página no registra aceptaciones ni ejecuta sanciones.</p>
    </header>

    <p v-if="loading" role="status" class="rounded-xl border border-slate-200 bg-white p-6">Cargando términos publicados…</p>
    <div v-else-if="error" :role="status === 404 ? 'status' : 'alert'" class="rounded-xl border border-slate-200 bg-white p-6">
      <p>{{ status === 404 ? 'No hay términos publicados disponibles para esta consulta.' : error }}</p>
      <button type="button" class="mt-4 rounded-lg border border-blue-600 px-4 py-2 font-medium text-blue-700" @click="refresh">Volver a intentar</button>
    </div>

    <template v-else-if="terms">
      <div class="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h2 class="font-semibold">{{ terms.title ?? 'Título no disponible' }}</h2>
        <p class="mt-1 text-sm">Versión {{ terms.number }} · Publicación: {{ publicationLabel(terms.publishedAt) }} (America/Lima)</p>
      </div>
      <p v-if="terms.policiesStatus !== 'COMPLETE'" role="status" class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
        {{ terms.policiesStatus === 'INCOMPLETE' ? 'La matriz vinculada a esta versión está incompleta.' : 'Esta versión no tiene una matriz estructurada vinculada.' }} No se sustituye con reglas actuales ni valores supuestos. Consulte también el texto publicado.
      </p>

      <section v-if="families.length" aria-labelledby="terms-matrix" class="space-y-3">
        <h2 id="terms-matrix" class="text-xl font-bold">Reglas y consecuencias de esta versión</h2>
        <details v-for="family in families" :key="family.kind" class="terms-accordion rounded-xl border border-slate-200 bg-white">
          <summary class="cursor-pointer rounded-xl p-5 font-semibold">{{ family.label }} <span class="text-sm font-normal text-slate-500">({{ family.policies.length }})</span></summary>
          <div class="grid gap-4 border-t border-slate-100 p-4 lg:grid-cols-2">
            <article v-for="policy in family.policies" :key="policy.id" class="min-w-0 rounded-lg border border-slate-200 p-4">
              <h3 class="font-semibold capitalize">{{ policyLabel(policy.category) }} · {{ policyLabel(policy.severity) }}</h3>
              <p class="mt-1 break-all text-xs text-slate-500">{{ policy.key }} · regla v{{ policy.number }}</p>
              <p class="mt-3 text-sm text-slate-700">{{ policy.criteria.condition }}</p>
              <dl class="mt-4 space-y-3 text-sm">
                <div v-for="detail in criteriaDetails(policy)" :key="detail.label"><dt class="font-medium">{{ detail.label }}</dt><dd class="text-slate-600">{{ detail.value }}</dd></div>
                <div><dt class="font-medium">Efecto en confianza</dt><dd>{{ confidenceLabel(policy) }}</dd></div>
                <div><dt class="font-medium">Suspensión</dt><dd>{{ suspensionLabel(policy) }}</dd></div>
                <div><dt class="font-medium">Consecuencia publicada</dt><dd class="text-slate-600">{{ policy.consequence }}</dd></div>
              </dl>
            </article>
          </div>
        </details>
      </section>

      <section aria-labelledby="terms-full" class="space-y-3">
        <h2 id="terms-full" class="text-xl font-bold">Texto completo: obligaciones, apelaciones y aceptación</h2>
        <p class="text-sm text-slate-600">Contenido documental de la base de datos, sin abreviar ni reemplazar su versión.</p>
        <p v-if="!sections.length" role="status">El contenido de esta versión no está disponible.</p>
        <details v-for="(section, index) in sections" :key="index" class="terms-accordion rounded-xl border border-slate-200 bg-white">
          <summary class="cursor-pointer rounded-xl p-5 font-semibold">{{ section.title }}</summary>
          <div class="whitespace-pre-wrap break-words border-t border-slate-100 p-5 text-sm leading-7 text-slate-700">{{ section.body }}</div>
        </details>
      </section>
    </template>
  </section>
</template>

<style scoped>
.terms-accordion > summary:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
.terms-accordion[open] > summary { color: #1e40af; background: #eff6ff; }
</style>
