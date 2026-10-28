<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '../components/EmptyState.vue'
import { useGeneratedData } from '../composables/useGeneratedData'
import { projectDocumentation } from '../services/projectDocumentation'

const { data: db, loading } = useGeneratedData(projectDocumentation.database)
const search = ref('')
const query = computed(() => search.value.trim().toLocaleLowerCase())
const models = computed(() => (db.value?.models ?? []).filter(item => item.name.toLocaleLowerCase().includes(query.value)))
const enums = computed(() => (db.value?.enums ?? []).filter(item => item.name.toLocaleLowerCase().includes(query.value)))
const groups = computed(() => [...new Set(models.value.map(item => item.module))].map(module => ({ module, models: models.value.filter(item => item.module === module) })))
const relationsFor = (model: string) => db.value?.relations.filter(relation => relation.source === model) ?? []
const foreignKeys = (model: string, field: string) => relationsFor(model).filter(relation => relation.direction === 'outgoing' && relation.fields.includes(field))
const primaryKey = (entity: NonNullable<typeof db.value>['models'][number], field: NonNullable<typeof db.value>['models'][number]['fields'][number]) => field.attributes.some(item => item.name === 'id') || entity.attributes.some(item => item.name === 'id' && Array.isArray(item.positional[0]) && item.positional[0].includes(field.name))
</script>

<template>
  <section class="database-page">
    <p class="text-sm font-semibold uppercase tracking-widest text-blue-700">Contrato ORM · Prisma 8</p>
    <h1 class="mt-2 text-3xl font-bold">Base de datos</h1>
    <p class="mt-3 text-slate-600">Definición generada del contrato, sin conexión ni registros reales. Los módulos proceden de sus encabezados, no de un catálogo manual.</p>
    <p v-if="loading" class="mt-8" role="status">Cargando contrato…</p>
    <EmptyState v-else-if="!db" class="mt-8" title="Contrato ORM no disponible" detail="Genera los artefactos de Project Showcase para consultar los modelos y enums." />
    <template v-else>
      <p class="mt-4 text-sm text-slate-600">Fuente: <code>{{ db.source }}</code></p>
      <div class="mt-5 flex flex-wrap gap-3 text-sm">
        <span class="rounded-full bg-blue-100 px-4 py-2 text-blue-900">{{ db.models.length }} modelos</span>
        <span class="rounded-full bg-violet-100 px-4 py-2 text-violet-900">{{ db.enums.length }} enums</span>
        <span class="rounded-full bg-amber-100 px-4 py-2 text-amber-900">{{ db.relations.filter(item => item.direction === 'outgoing').length }} relaciones FK · {{ db.relations.length }} direcciones</span>
      </div>
      <label class="mt-6 block text-sm font-medium" for="db-search">Buscar modelos o enums por nombre</label>
      <input id="db-search" v-model="search" type="search" placeholder="Por ejemplo: Recurso" class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-2">
      <p class="mt-3 text-sm text-slate-600">PK: clave primaria · FK: clave foránea · ?: nullable · []: lista. Cardinalidad: 1, 0..1 o 0..n, en cada dirección.</p>
      <p v-if="!models.length && !enums.length" class="mt-8" role="status">No hay modelos ni enums que coincidan.</p>
      <div v-for="group in groups" :key="group.module" class="mt-8">
        <h2 class="text-xl font-semibold">{{ group.module }}</h2>
        <article v-for="entity in group.models" :key="entity.name" class="mt-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 class="text-lg font-bold text-blue-900">Modelo · {{ entity.name }}</h3>
          <div class="db-table-wrap mt-3" role="region" :aria-label="`Campos de ${entity.name}`" tabindex="0">
            <table class="db-table text-sm">
              <thead><tr><th>Campo</th><th>Tipo</th><th>Restricciones / definición</th></tr></thead>
              <tbody><tr v-for="field in entity.fields" :key="field.name">
                <th scope="row"><code>{{ field.name }}</code></th>
                <td><code>{{ field.typeExpression }}{{ field.nullable ? '?' : field.list ? '[]' : '' }}</code><span class="block text-xs text-slate-500">{{ field.kind === 'relation' ? 'Relación' : field.kind === 'enum' ? 'Enum' : 'Escalar' }}</span></td>
                <td>
                  <span v-if="primaryKey(entity, field)" class="mr-2 font-semibold">PK</span>
                  <span v-for="fk in foreignKeys(entity.name, field.name)" :key="fk.field" class="mr-2 font-semibold">FK → {{ fk.target }}.{{ fk.references.join(', ') }}</span>
                  <code v-for="attribute in field.attributes" :key="attribute.raw" class="block">{{ attribute.raw }}</code>
                  <span v-if="!field.attributes.length && !foreignKeys(entity.name, field.name).length">—</span>
                </td>
              </tr></tbody>
            </table>
          </div>
          <h4 class="mt-4 font-semibold">Índices, claves y restricciones del modelo</h4>
          <ul class="mt-1 text-sm"><li v-for="attribute in entity.attributes" :key="attribute.raw"><code>{{ attribute.raw }}</code></li></ul>
          <h4 v-if="relationsFor(entity.name).length" class="mt-4 font-semibold">Relaciones y referencias</h4>
          <ul class="mt-2 space-y-2 text-sm">
            <li v-for="relation in relationsFor(entity.name)" :key="relation.field" class="rounded-lg bg-amber-50 p-3">
              <p><strong>{{ relation.field }}</strong>: {{ relation.source }} ({{ relation.sourceCardinality }}) → {{ relation.target }} ({{ relation.targetCardinality }}) · {{ relation.direction === 'outgoing' ? 'saliente · posee FK' : 'entrante · inversa' }}</p>
              <p>FK: {{ relation.owner }}.({{ relation.fields.join(', ') }}) → {{ relation.direction === 'outgoing' ? relation.target : relation.source }}.({{ relation.references.join(', ') }})</p>
              <p>Inversa: {{ relation.target }}.{{ relation.inverse }}<span v-if="relation.name"> · Nombre: {{ relation.name }}</span></p>
              <p>onDelete: {{ relation.onDelete ?? 'no declarado' }} · onUpdate: {{ relation.onUpdate ?? 'no declarado' }}</p>
            </li>
          </ul>
        </article>
      </div>
      <section v-if="enums.length" class="mt-10">
        <h2 class="text-xl font-semibold text-violet-900">Enumeraciones</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <article v-for="entity in enums" :key="entity.name" class="min-w-0 rounded-2xl border border-violet-200 bg-white p-4">
            <h3 class="font-bold">Enum · {{ entity.name }}</h3>
            <code v-for="attribute in entity.attributes" :key="attribute.raw" class="mt-1 block text-xs text-slate-500">{{ attribute.raw }}</code>
            <ul class="mt-3 text-sm"><li v-for="value in entity.values" :key="value.name"><code>{{ value.name }} <span v-for="attribute in value.attributes" :key="attribute.raw">{{ attribute.raw }}</span></code></li></ul>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.database-page { min-width: 0; overflow-wrap: anywhere; }
.db-table-wrap { max-width: 100%; overflow-x: auto; }
.db-table { width: 100%; border-collapse: collapse; text-align: left; }
.db-table th, .db-table td { padding: .6rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
.db-table code { white-space: normal; overflow-wrap: anywhere; }
.db-table tbody th { font-weight: 500; }
</style>
