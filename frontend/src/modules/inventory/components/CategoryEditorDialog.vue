<script setup lang="ts">
import { computed, ref } from 'vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import RemoteState from '../../../shared/components/RemoteState.vue'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import { mutationConfirmation, pendingMutation } from '../../../shared/api/mutation-guard'
import { getCategories, type Category } from '../api/inventory-api'
import { categoryMatches, categorySaveKey, readCategory, readCategoryPolicies, saveCategory, type CategoryInput } from '../api/categories-api'
import { confidenceLabel, criteriaDetails, policyFamilies, suspensionLabel } from '../../project-showcase/services/termsPresentation'

const props = defineProps<{ category: Category | null }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const id = ref(props.category?.id ?? null)
const name = ref(props.category?.nombre ?? '')
const description = ref(props.category?.descripcion ?? '')
const active = ref(props.category?.activo ?? true)
const hours = ref<number | ''>(props.category?.tiempoMaximoPrestamoHoras ?? 24)
const section = ref('General')
const sections = ['General', 'Préstamos', 'Confianza', 'Sanciones']
const busy = ref(false), error = ref(''), notice = ref('')
const input = computed<CategoryInput>(() => ({ nombre: name.value.trim(), descripcion: description.value.trim() || null, activo: active.value,
  tiempoMaximoPrestamoHoras: Number(hours.value), tiempoMaximoPrestamoDias: Math.max(1, Math.ceil(Number(hours.value) / 24)) }))
const pending = computed(() => pendingMutation(categorySaveKey(id.value, input.value)))
const policies = useRemote(signal => id.value ? readCategoryPolicies(id.value, signal) : Promise.resolve(null), id)
const shownPolicies = computed(() => (policies.data.value?.policies ?? []).filter(policy => section.value === 'Confianza'
  ? ['ACCESS', 'TRUST'].includes(policy.kind) : section.value === 'Préstamos'
    ? ['ACCESS', 'REWARD'].includes(policy.kind) : ['LATENESS', 'DAMAGE', 'LOSS', 'NO_SHOW'].includes(policy.kind)))
async function save() {
  if (busy.value || pending.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const result = await saveCategory(id.value, input.value)
    id.value = result.id
    notice.value = 'Categoría confirmada. No se han modificado ni copiado reglas publicadas.'
    emit('changed')
    await policies.refresh()
  } catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}
async function consult() {
  if (busy.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const key = categorySaveKey(id.value, input.value)
    const confirm = mutationConfirmation()
    const matches = id.value ? [await readCategory(id.value)] : (await getCategories()).filter(item => categoryMatches(item, input.value))
    if (matches.length !== 1 || !categoryMatches(matches[0]!, input.value)) throw new Error('No se pudo confirmar el guardado exacto. Se conserva el formulario; no se repetirá la creación automáticamente.')
    confirm(key)
    id.value = matches[0]!.id
    notice.value = 'Estado consultado: los datos coinciden con el servidor.'
    emit('changed')
    await policies.refresh()
  } catch (cause) { error.value = errorMessage(cause) }
  finally { busy.value = false }
}
</script>
<template>
  <ModalDialog :title="id ? 'Editar categoría' : 'Nueva categoría'" subtitle="Categoría: condiciones de préstamo. Ejemplar: unidad física." :busy="busy" @close="emit('close')">
    <nav class="category-tabs" aria-label="Secciones de categoría"><button v-for="item in sections" :key="item" :aria-pressed="section === item" :disabled="busy" @click="section = item">{{ item }}</button></nav>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="!id" role="status">Nueva categoría sin políticas oficiales propias: no apta para nuevos préstamos hasta su publicación completa.</p>
    <p v-if="id && policies.data.value && !policies.data.value.eligibleForNewOperations" role="status">No apta para nuevas operaciones: categoría inactiva o políticas incompletas/no disponibles.</p>
    <p v-if="pending" role="status">Resultado incierto. Consulta el servidor antes de volver a guardar.</p>
    <button v-if="pending" :disabled="busy" @click="consult">Consultar estado guardado</button>
    <form class="category-form stack" @submit.prevent="save">
      <fieldset v-show="section === 'General'" :disabled="busy || pending">
        <legend>General</legend>
        <label>Nombre<input v-model="name" required maxlength="120" /></label>
        <label>Descripción<textarea v-model="description" maxlength="2000" rows="3" /></label>
        <label>Estado<select v-model="active"><option :value="true">Activa</option><option :value="false">Inactiva</option></select></label>
        <p>Desactivar es reversible y conserva recursos, ejemplares e historia.</p>
      </fieldset>
      <fieldset v-show="section === 'Préstamos'" :disabled="busy || pending">
        <legend>Préstamos</legend>
        <label>Duración predeterminada (horas)<input v-model.number="hours" required type="number" min="1" max="2147483647" step="1" /></label>
        <p>Los recursos heredan esta duración salvo excepción individual. Solo afecta nuevas operaciones; no cambia reservas ni préstamos existentes.</p>
        <h3>Condiciones de uso publicadas</h3>
      </fieldset>
      <button v-if="section === 'General' || section === 'Préstamos'" type="submit" class="primary" :disabled="busy || pending || !name.trim() || !Number.isInteger(Number(hours)) || Number(hours) < 1 || Number(hours) > 2147483647">Guardar categoría</button>
    </form>
    <section v-if="section !== 'General'" class="policy-reading" :aria-label="section + ': reglas publicadas'">
      <h3 v-if="section === 'Confianza'">Niveles permitidos</h3>
      <h3 v-if="section === 'Sanciones'">Incumplimientos y gravedad: leve, moderada y grave</h3>
      <p>Solo lectura. Edición y publicación coordinada por categoría pendiente; no se guardan cambios de reglas desde esta operación.</p>
      <p v-if="policies.error.value">Configuración publicada no disponible de forma segura; no se pueden editar reglas.</p>
      <p v-if="!id">Sin políticas oficiales propias: esta nueva categoría no es apta para nuevos préstamos hasta su publicación completa. No se asignan sanciones de otras categorías.</p>
      <RemoteState v-else :loading="policies.loading.value" :error="policies.error.value" @retry="policies.refresh">
        <template v-if="policies.data.value">
          <p role="status">{{ policies.data.value.eligibleForNewOperations ? 'Apta para nuevas operaciones según publicación actual.' : 'No apta para nuevas operaciones: categoría inactiva o políticas incompletas/no disponibles.' }} Estado: {{ policies.data.value.status }}.</p>
          <p>{{ policies.data.value.message }}</p>
          <p>Versión de términos: {{ policies.data.value.termsVersionId || 'No disponible' }}</p>
          <article v-for="policy in shownPolicies" :key="policy.id" class="published-rule">
            <h4>{{ policyFamilies.find(family => family.kind === policy.kind)?.label }} · {{ policy.severity || 'General' }}</h4>
            <p>{{ policy.title }} · versión {{ policy.number }} · {{ policy.id }}</p>
            <p>{{ policy.criteria.condition }}</p>
            <dl><template v-for="detail in criteriaDetails(policy)" :key="detail.label"><dt>{{ detail.label }}</dt><dd>{{ detail.value }}</dd></template>
              <dt>Descuento de confianza</dt><dd>{{ confidenceLabel(policy) }}</dd>
              <dt>Suspensión</dt><dd>{{ suspensionLabel(policy) }}</dd>
              <dt>Consecuencias</dt><dd>{{ policy.consequence }}</dd>
            </dl>
          </article>
          <p v-if="!shownPolicies.length">Falta configuración publicada para esta sección. No se infieren umbrales ni niveles.</p>
        </template>
      </RemoteState>
    </section>
  </ModalDialog>
</template>
<style scoped>
.category-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
.category-tabs [aria-pressed='true'] { background: #1e3a5f; color: white; }
.category-form fieldset { min-width: 0; border: 0; padding: 0; margin: 0 0 16px; }
.category-form legend { font-weight: 700; margin-bottom: 12px; }
.category-form label { display: block; font-size: 13px; margin-bottom: 12px; }
.category-form :is(input, textarea, select) { display: block; width: 100%; margin-top: 6px; }
.category-form p, .policy-reading { font-size: 13px; line-height: 1.6; }
.policy-reading { margin-top: 20px; overflow-wrap: anywhere; }
.published-rule { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-top: 12px; }
.published-rule h4 { margin: 0; }
.published-rule dt { font-weight: 700; }
.published-rule dd { margin: 0 0 8px; }
</style>
