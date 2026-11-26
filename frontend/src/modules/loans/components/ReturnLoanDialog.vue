<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { errorMessage } from '../../../shared/composables/useRemote'
import { getReturnPolicy, getLoanEvidence, type Loan } from '../api/loans-api'
import type { LoanEvidence } from '../api/closure-contracts'
import { returnInput, type ReturnPolicy, type PhysicalCondition, type Severity } from '../return-policy'
import { useLoanClosure } from '../useLoanClosure'
import ReturnChecklist from './ReturnChecklist.vue'
import ClosureResult from './ClosureResult.vue'
import { inventoryActionAllowed, inventoryCompatibilityMessage, type InventoryCompatibility } from '../../inventory/api/compatibility-contracts'
const props = defineProps<{ loan: Loan; copyLabel: string; compatibility?: InventoryCompatibility | null }>()
const emit = defineEmits<{ close: []; changed: []; success: [] }>()
const closure = useLoanClosure(props.loan.id, () => emit('success'))
const { busy, error, notice, result, locked, pending, reconciled } = closure
const policy = ref<ReturnPolicy | null>(null), loading = ref(false), loadError = ref('')
const parts = ref<Record<string, boolean | null>>({}), condition = ref<PhysicalCondition | ''>('')
const damage = ref<Severity | ''>(''), missing = ref<Severity | ''>(''), description = ref(''), observation = ref('')
const evidence = ref<LoanEvidence[]>([]), evidenceIds = ref<string[]>([])
const controller = new AbortController()
onBeforeUnmount(() => controller.abort())
const hasMissing = computed(() => Object.values(parts.value).some(v => v === false))
const incident = computed(() => condition.value === 'DANADO' || hasMissing.value)
const ready = computed(() => inventoryActionAllowed(props.compatibility, 'release') && props.loan.status === 'ACTIVO' && !!policy.value && !!condition.value && policy.value.accessories.every(p => typeof parts.value[p.id] === 'boolean') &&
  (!incident.value || !!description.value.trim()) && (condition.value !== 'DANADO' || !!damage.value) && (!hasMissing.value || !!missing.value))
async function load() {
  if (busy.value || loading.value || locked.value) return
  loading.value = true; loadError.value = ''; policy.value = null
  try {
    const [historical, available] = await Promise.all([getReturnPolicy(props.loan.id, controller.signal), getLoanEvidence(props.loan.id, controller.signal)])
    policy.value = historical
    parts.value = Object.fromEntries(historical.accessories.map(p => [p.id, null]))
    evidence.value = available.filter(e => e.type === 'DEVOLUCION' || e.type === 'DANO')
    evidenceIds.value = []
  } catch (cause) { if (!controller.signal.aborted) loadError.value = errorMessage(cause) }
  finally { loading.value = false }
}
async function confirm() {
  if (!ready.value || locked.value || busy.value || !policy.value) return
  try {
    const body = returnInput(crypto.randomUUID(), policy.value, parts.value, condition.value, damage.value, missing.value, description.value, evidenceIds.value, observation.value)
    await closure.send(body)
  } catch (cause) { error.value = errorMessage(cause) }
}
onMounted(() => { void load() })
</script>
<template>
  <ModalDialog class="return-dialog" title="Registrar devolución integral" :subtitle="copyLabel" :busy="busy || loading" @close="emit('close')">
    <div class="stack return-body" :aria-busy="busy || loading">
      <ClosureResult v-if="result" :loan="result" />
      <template v-else>
        <p v-if="inventoryCompatibilityMessage(compatibility)" role="status">{{ inventoryCompatibilityMessage(compatibility) }} No se habilita un cierre nuevo; el servidor revalida las garantías del cierre integral.</p>
        <p v-if="loan.status !== 'ACTIVO'" role="alert">Solo los préstamos ACTIVOS pueden cerrarse con una nueva devolución.</p>
        <p v-if="loading" role="status">Consultando política histórica y evidencias…</p>
        <p v-if="loadError" class="error" role="alert">{{ loadError }} No se permite cerrar sin política histórica.</p>
        <button v-if="loadError" :disabled="loading" @click="load">Reintentar lectura histórica</button>
        <form v-if="policy" class="stack" @submit.prevent="confirm">
          <p>Categoría histórica {{ policy.categoryId }} · Publicación {{ policy.termsVersionId }}.</p>
          <section aria-label="Tardanza automática" class="panel">
            <h3>Tardanza AUTOMÁTICA · solo lectura</h3>
            <p>Ya aplicada: {{ policy.lateness.currentSeverity ?? 'Ninguna' }} · {{ policy.lateness.appliedPenaltyPoints }} puntos.</p>
            <p>Proyectada al consultar: {{ policy.lateness.targetSeverity ?? 'Ninguna' }} · {{ policy.lateness.targetPenaltyPoints }} puntos nominales · {{ policy.lateness.targetSuspensionDays }} días. El servidor recalcula al cerrar; no es un segundo cargo manual.</p>
          </section>
          <ReturnChecklist v-model="parts" :parts="policy.accessories" :disabled="busy || locked" />
          <fieldset :disabled="busy || locked" class="stack">
            <legend>Condición física obligatoria</legend>
            <label><input v-model="condition" type="radio" name="condition" value="SANO" /> Sano</label>
            <label><input v-model="condition" type="radio" name="condition" value="DESGASTE_NORMAL" /> Desgaste normal (no es daño)</label>
            <label><input v-model="condition" type="radio" name="condition" value="DANADO" /> Dañado</label>
            <template v-if="incident">
              <p>Daño y faltantes del mismo hecho generan una sola falta, con la mayor gravedad seleccionada. El tipo y la consecuencia los determina la política histórica.</p>
              <label v-if="condition === 'DANADO'">Gravedad del daño<select v-model="damage" required><option value="">Seleccionar según criterios</option><option v-for="p in policy.damageOptions" :key="p.versionId" :value="p.severity">{{ p.severity }} · {{ p.criteria.condition }}</option></select></label>
              <label v-if="hasMissing">Gravedad de faltantes<select v-model="missing" required><option value="">Seleccionar según criterios</option><option v-for="p in policy.damageOptions" :key="p.versionId" :value="p.severity">{{ p.severity }} · {{ p.criteria.condition }}</option></select></label>
              <ul><li v-for="p in policy.damageOptions" :key="p.versionId">{{ p.severity }}: {{ p.criteria.condition }} · {{ p.consequence }} · {{ p.penaltyPoints ?? 'No aplica' }} puntos · suspensión {{ p.suspensionType }} {{ p.suspensionDays ?? '' }}. Versión {{ p.versionId }}.</li></ul>
              <label>Descripción de daño/faltantes<textarea v-model="description" required maxlength="1000" /></label>
            </template>
            <label>Observación opcional (no determina daño)<textarea v-model="observation" maxlength="1000" /></label>
            <fieldset><legend>Evidencias existentes de este préstamo</legend>
              <label v-for="e in evidence" :key="e.id"><input v-model="evidenceIds" type="checkbox" :value="e.id" /> {{ e.originalName }} · {{ e.description }}</label>
              <p v-if="!evidence.length">Sin evidencias disponibles. Se enviará la colección vacía admitida por el servidor.</p>
            </fieldset>
            <p>Recompensa histórica: {{ policy.rewardPolicy.consequence }}. Solo se mostrará el importe realmente persistido.</p>
          </fieldset>
          <button class="primary" :disabled="!ready || busy || locked">{{ busy ? 'Registrando…' : 'Confirmar devolución integral' }}</button>
        </form>
        <div v-if="locked" class="stack"><p role="alert">Resultado pendiente. No se pueden modificar ni reenviar datos distintos.</p><button :disabled="busy" @click="closure.check">Consultar cierre del préstamo</button><button v-if="pending && reconciled" :disabled="busy" @click="closure.retry">Reintentar mismo cuerpo y UUID</button></div>
      </template>
      <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
      <button :disabled="busy || loading" @click="emit('close')">Cerrar</button>
    </div>
  </ModalDialog>
</template>
<style scoped>
.return-body { padding: 12px; } fieldset { min-width: 0; } select, textarea { max-width: 100%; } p, li { overflow-wrap: anywhere; }
</style>
