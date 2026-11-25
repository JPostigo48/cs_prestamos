<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { errorMessage } from '../../../shared/composables/useRemote'
import { getLoanEvidence, getReturnPolicy, type Loan } from '../api/loans-api'
import type { LoanEvidence } from '../api/closure-contracts'
import type { ReturnPolicy } from '../return-policy'
import { useLoanClosure } from '../useLoanClosure'
import ClosureResult from './ClosureResult.vue'
const props = defineProps<{ loan: Loan; copyLabel: string }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const closure = useLoanClosure(props.loan.id, () => emit('changed'))
const { busy, locked, result, error, notice, pending, reconciled } = closure
const kind = ref<'' | 'PERDIDA' | 'ROBO'>(''), description = ref(''), confirmed = ref(false)
const evidence = ref<LoanEvidence[]>([]), evidenceIds = ref<string[]>([]), policy = ref<ReturnPolicy | null>(null), loading = ref(false)
async function load() {
  loading.value = true; error.value = ''
  try { const [p, e] = await Promise.all([getReturnPolicy(props.loan.id), getLoanEvidence(props.loan.id)]); policy.value = p; evidence.value = e.filter(e => e.type === 'PERDIDA') }
  catch (cause) { error.value = errorMessage(cause) }
  finally { loading.value = false }
}
async function confirm() {
  if ((kind.value !== 'PERDIDA' && kind.value !== 'ROBO') || props.loan.status !== 'ACTIVO' || !confirmed.value || !description.value.trim() || !policy.value || locked.value || busy.value) return
  await closure.send({ requestId: crypto.randomUUID(), kind: kind.value, confirmed: true, description: description.value.trim(), evidenceIds: [...evidenceIds.value] })
}
onMounted(() => { if (!locked.value) void load() })
</script>
<template>
  <ModalDialog title="Cerrar por pérdida o robo" :subtitle="copyLabel" :busy="busy || loading" @close="emit('close')">
    <ClosureResult v-if="result" :loan="result" />
    <form v-else-if="policy && !locked" class="stack" @submit.prevent="confirm">
      <fieldset :disabled="busy" class="stack"><legend>Incidente terminal confirmado</legend>
        <p>No registra devolución ni inspección ficticia. No acredita recompensa. El ejemplar queda retenido.</p>
        <p>{{ policy.lossPolicy.criteria.condition }} · {{ policy.lossPolicy.consequence }}</p>
        <label>Tipo<select v-model="kind" required><option value="" disabled>Selecciona el tipo de incidente</option><option value="PERDIDA">Pérdida</option><option value="ROBO">Robo</option></select></label>
        <label>Descripción obligatoria<textarea v-model="description" required maxlength="1000" /></label>
        <fieldset><legend>Evidencias de pérdida del mismo préstamo</legend><label v-for="e in evidence" :key="e.id"><input v-model="evidenceIds" type="checkbox" :value="e.id" />{{ e.originalName }}</label><p v-if="!evidence.length">Sin evidencias disponibles; colección vacía permitida.</p></fieldset>
        <label><input v-model="confirmed" type="checkbox" required /> Confirmo la pérdida o robo y el cierre irreversible por incidencia, no una devolución.</label>
      </fieldset>
      <button class="primary" :disabled="(kind !== 'PERDIDA' && kind !== 'ROBO') || loan.status !== 'ACTIVO' || busy || !confirmed || !description.trim()">Confirmar cierre por incidencia</button>
    </form>
    <p v-if="loading" role="status">Consultando política y evidencias…</p>
    <button v-if="!loading && !policy && !locked" @click="load">Reintentar lectura</button>
    <div v-if="locked"><p role="alert">Resultado incierto; datos originales conservados.</p><button :disabled="busy" @click="closure.check">Consultar cierre del préstamo</button><button v-if="pending && reconciled" :disabled="busy" @click="closure.retry">Reintentar mismo cuerpo y UUID</button></div>
    <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <button :disabled="busy || loading" @click="emit('close')">Cerrar</button>
  </ModalDialog>
</template>
