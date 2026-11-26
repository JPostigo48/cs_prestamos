<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { changeCopyState, getCopyEvidence, type Copy } from '../api/inventory-api'
import type { LoanEvidence } from '../../loans/api/closure-contracts'
import { errorMessage } from '../../../shared/composables/useRemote'
import { inventoryActionAllowed } from '../api/compatibility-contracts'
import InventoryCompatibilityNotice from './InventoryCompatibilityNotice.vue'
const props = defineProps<{ copy: Copy; disabled?: boolean }>()
const emit = defineEmits<{ close: []; changed: []; busy: [value: boolean] }>()
const fit = ref(false), complete = ref(false), reason = ref(''), ids = ref<string[]>([])
const evidence = ref<LoanEvidence[] | null>(null), loading = ref(false), sending = ref(false), error = ref('')
const controller = new AbortController()
const canRehabilitate = () => !props.disabled && props.copy.habilitado === true && props.copy.estado === 'NO_DISPONIBLE' && inventoryActionAllowed(props.copy.compatibility, 'rehabilitate') && inventoryActionAllowed(props.copy.compatibility, 'release')
onBeforeUnmount(() => controller.abort())
async function load() {
  if (!canRehabilitate()) return
  loading.value = true; error.value = ''; evidence.value = null
  try { evidence.value = await getCopyEvidence(props.copy, controller.signal) }
  catch (cause) { if (!controller.signal.aborted) error.value = errorMessage(cause) }
  finally { loading.value = false }
}
async function confirm() {
  if (sending.value || !canRehabilitate() || !fit.value || !complete.value || !reason.value.trim() || !evidence.value) return
  sending.value = true; emit('busy', true); error.value = ''
  try { await changeCopyState(props.copy, 'DISPONIBLE', { fitForLoan: true, componentsComplete: true, reason: reason.value.trim(), evidenceIds: [...ids.value] }); emit('changed'); emit('close') }
  catch (cause) { error.value = errorMessage(cause) }
  finally { sending.value = false; emit('busy', false) }
}
onMounted(() => { void load() })
</script>
<template>
  <ModalDialog title="Verificar rehabilitación del ejemplar" :subtitle="copy.codigoInventario" :busy="sending || loading" @close="emit('close')">
    <form class="stack" @submit.prevent="confirm">
      <InventoryCompatibilityNotice :compatibility="copy.compatibility" />
      <p>No levanta sanciones ni restituye confianza. No habilita administrativamente. El servidor comprobará recurso/categoría activos y ausencia de compromisos.</p>
      <fieldset :disabled="sending || loading || !canRehabilitate()"><legend>Verificación física explícita</legend>
        <label><input v-model="fit" type="checkbox" required /> Comprobé que es apto para préstamo</label>
        <label><input v-model="complete" type="checkbox" required /> Comprobé que todos los componentes están completos</label>
        <label>Motivo de rehabilitación<textarea v-model="reason" required maxlength="1000" /></label>
        <fieldset><legend>Evidencias disponibles del mismo ejemplar</legend><label v-for="e in evidence" :key="e.id"><input v-model="ids" type="checkbox" :value="e.id" />{{ e.originalName }}</label><p v-if="evidence?.length === 0">Sin evidencias disponibles: se enviará una colección vacía.</p></fieldset>
      </fieldset>
      <p v-if="loading" role="status">Verificando evidencias…</p><p v-if="error" class="error" role="alert">{{ error }}</p>
      <button v-if="evidence === null && !loading" type="button" :disabled="!canRehabilitate()" @click="load">Reintentar evidencias</button>
      <button class="primary" :disabled="sending || loading || !canRehabilitate() || !evidence || !fit || !complete || !reason.trim()">Confirmar rehabilitación verificada</button>
      <button type="button" :disabled="sending || loading" @click="emit('close')">Cerrar</button>
    </form>
  </ModalDialog>
</template>
