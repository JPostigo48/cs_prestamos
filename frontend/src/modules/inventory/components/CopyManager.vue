<script setup lang="ts">
import { ref } from 'vue'
import { getCopies, createCopy, changeCopyState, type Copy } from '../api/inventory-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import { getSession } from '../../auth/api/auth-api'
import RehabilitateCopyDialog from './RehabilitateCopyDialog.vue'
import { isStaff } from '../../auth/access-policy'
import { inventoryActionAllowed, type InventoryCompatibility } from '../api/compatibility-contracts'
import InventoryCompatibilityNotice from './InventoryCompatibilityNotice.vue'
const canCreate = getSession()?.user.role === 'ADMINISTRADOR'
const canManage = isStaff(getSession()?.user.role ?? 'USUARIO')
const props = defineProps<{ resourceId: string; disabled?: boolean; compatibility?: InventoryCompatibility | null }>()
const emit = defineEmits<{ changed: []; busy: [value: boolean] }>()
const copies = useRemote((signal) => getCopies(props.resourceId, signal))
const code = ref(''),
  sending = ref(false),
  error = ref(''),
  notice = ref('')
const selected = ref<Copy | null>(null)
const rehabilitating = ref<Copy | null>(null)
function canChange(copy: Copy) {
  return !props.disabled && !copies.loading.value && !copies.error.value && inventoryActionAllowed(props.compatibility, 'manageCopy') && inventoryActionAllowed(copy.compatibility, 'manageCopy') &&
    (copy.estado === 'DISPONIBLE' || (copy.estado === 'NO_DISPONIBLE' && copy.habilitado === true && inventoryActionAllowed(copy.compatibility, 'rehabilitate') && inventoryActionAllowed(copy.compatibility, 'release')))
}
function choose(copy: Copy) { if (!canChange(copy)) return; if (copy.estado === 'NO_DISPONIBLE') rehabilitating.value = copy; else selected.value = copy }
async function rehabilitated() { await copies.refresh(); notice.value = 'Rehabilitación verificada, sin cambios en sanciones ni confianza.'; emit('changed') }
async function add() {
  if (sending.value || props.disabled || !code.value.trim() || !canCreate || !inventoryActionAllowed(props.compatibility, 'create')) return
  sending.value = true
  emit('busy', true)
  error.value = ''
  notice.value = ''
  try {
    const result = await createCopy(props.resourceId, code.value)
    notice.value = 'Ejemplar confirmado: ' + result.codigoInventario
    code.value = ''
    await copies.refresh()
    emit('changed')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
    emit('busy', false)
  }
}
async function state() {
  if (!selected.value || sending.value || !canChange(selected.value) || !canManage) return
  sending.value = true
  emit('busy', true)
  error.value = ''
  notice.value = ''
  try {
    await changeCopyState(
      selected.value,
      selected.value.estado === 'DISPONIBLE' ? 'NO_DISPONIBLE' : 'DISPONIBLE',
    )
    selected.value = null
    await copies.refresh()
    notice.value = 'Estado confirmado por el servidor.'
    emit('changed')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
    emit('busy', false)
  }
}
</script>
<template>
  <section class="stack copy-manager">
    <h3>Ejemplares y códigos de inventario</h3>
    <InventoryCompatibilityNotice :compatibility="compatibility" />
    <p class="muted">Cada ejemplar tiene un código único. Las cantidades se calculan a partir de los ejemplares registrados.</p>
    <RemoteState :loading="copies.loading.value" :error="copies.error.value" @retry="copies.refresh"
      ><p v-if="copies.data.value">Total exacto: {{ copies.data.value.length }}</p>
      <ul class="copy-list">
        <li v-for="copy in copies.data.value" :key="copy.id">
          <div><strong>{{ copy.codigoInventario }}</strong><StatusBadge :tone="copy.estado === 'DISPONIBLE' ? 'success' : copy.estado === 'NO_DISPONIBLE' ? 'neutral' : 'warning'">{{ copy.estado.replaceAll('_', ' ') }}</StatusBadge></div>
          <p>Condición: {{ copy.condicionFisica ?? 'Desconocida: requiere verificación' }} · {{ copy.habilitado === null ? 'Habilitación administrativa desconocida' : copy.habilitado ? 'Habilitado administrativamente' : 'Deshabilitado administrativamente' }}<span v-if="copy.estado === 'NO_DISPONIBLE'"> · Retenido / no prestable</span></p>
          <InventoryCompatibilityNotice v-if="copy.compatibility?.status !== compatibility?.status" :compatibility="copy.compatibility" />
          <button
            v-if="canManage && (copy.estado === 'DISPONIBLE' || copy.estado === 'NO_DISPONIBLE')"
            type="button"
            :disabled="sending || !canChange(copy)"
            @click="choose(copy)"
          >
            {{ copy.estado === 'DISPONIBLE' ? 'Retener' : 'Verificar rehabilitación' }}
          </button>
        </li>
      </ul>
      <p v-if="copies.data.value?.length === 0">No hay ejemplares.</p></RemoteState
    >
    <div v-if="selected" class="panel copy-confirmation" role="group" aria-label="Confirmar cambio de disponibilidad">
      <p>¿Cambiar disponibilidad de {{ selected.codigoInventario }}?</p>
      <button type="button" :disabled="sending" @click="selected = null">Cancelar</button
      ><button type="button" :disabled="sending || !canChange(selected)" @click="state">Confirmar cambio</button>
    </div>
    <RehabilitateCopyDialog v-if="rehabilitating" :copy="rehabilitating" :disabled="!canChange(rehabilitating)" @close="rehabilitating = null" @changed="rehabilitated" @busy="sending = $event; emit('busy', $event)" />
    <form v-if="canCreate" class="row" @submit.prevent="add">
      <label
        >Código único del nuevo ejemplar<input
          v-model="code"
          required
          maxlength="80"
          :disabled="sending || disabled || !inventoryActionAllowed(compatibility, 'create')" /></label
      ><button class="primary" :disabled="sending || disabled || !code.trim() || !inventoryActionAllowed(compatibility, 'create')">Añadir ejemplar</button>
    </form>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
  </section>
</template>
<style scoped>
.copy-manager h3 { font-size: 15px; font-weight: 800; }
.copy-manager p { font-size: 12px; line-height: 1.6; }
.copy-list { list-style: none; padding: 0; }
.copy-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; margin-bottom: 8px; }
.copy-list li > div { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.copy-list strong { font-family: ui-monospace, monospace; font-size: 12px; }
.copy-list button { font-size: 11px; }
.copy-manager .row { align-items: end; }
.copy-manager label { flex: 1 1 200px; font-size: 12px; color: #64748b; font-weight: 600; }
.copy-manager input { width: 100%; margin-top: 6px; }
.copy-confirmation { background: #fffbeb; border-color: #fde68a; }
.copy-confirmation p { margin-bottom: 12px; }
.copy-confirmation button { margin: 0 8px 8px 0; }
</style>
