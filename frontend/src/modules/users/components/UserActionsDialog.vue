<script setup lang="ts">
import { ref } from 'vue'
import { findAccount, updateRole } from '../api/users-admin-api'
import { getSanctions, type UserProfile } from '../api/student-api'
import { suspendUser, liftSanction } from '../../trust/api/trust-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { dateTime } from '../../../shared/format'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import { ShieldCheck, UserRound, Ban, Scale } from '@lucide/vue'
const props = defineProps<{ user: UserProfile }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const account = useRemote(
  (signal) => findAccount(props.user.id, signal),
  () => true,
  false,
)
const sanctions = useRemote((signal) => getSanctions(props.user.id, signal))
const section = ref<'account' | 'suspend' | 'sanctions'>('account')
const role = ref<'USUARIO' | 'OPERADOR'>('USUARIO'),
  reason = ref(''),
  startsAt = ref(''),
  endsAt = ref(''),
  sanctionId = ref(''),
  resolution = ref('')
const sending = ref(false),
  error = ref(''),
  notice = ref('')
async function run(action: 'role' | 'suspend' | 'lift') {
  if (sending.value) return
  sending.value = true
  error.value = ''
  notice.value = ''
  try {
    if (action === 'role') {
      if (!account.data.value) throw new Error('Consulta primero la cuenta real.')
      await updateRole(account.data.value, role.value)
      await account.refresh()
      notice.value = 'Rol actualizado. Los tokens ya emitidos no se revocan automáticamente.'
    } else if (action === 'suspend') {
      if (!reason.value.trim() || !startsAt.value) throw new Error('Motivo e inicio obligatorios.')
      const start = new Date(startsAt.value),
        end = endsAt.value ? new Date(endsAt.value) : null
      if (
        !Number.isFinite(start.getTime()) ||
        (end && (!Number.isFinite(end.getTime()) || end <= start))
      )
        throw new Error('Fechas no válidas: el fin debe ser posterior al inicio.')
      const result = await suspendUser(props.user.id, {
        reason: reason.value.trim(),
        startsAt: start.toISOString(),
        endsAt: end?.toISOString() ?? null,
      })
      if (result.userId !== props.user.id)
        throw new Error('Respuesta de suspensión para otro usuario.')
      notice.value = 'Suspensión confirmada por el servidor.'
      await sanctions.refresh()
    } else {
      if (
        !sanctions.data.value?.some(
          (s) => s.id === sanctionId.value && ['ACTIVA', 'PROGRAMADA'].includes(s.status),
        ) ||
        !resolution.value.trim()
      )
        throw new Error('Selecciona una sanción activa/programada real y fundamenta la decisión.')
      await liftSanction(sanctionId.value, resolution.value.trim())
      notice.value = 'Resolución de sanción confirmada por el servidor.'
      await sanctions.refresh()
    }
    emit('changed')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
  }
}
</script>
<template>
  <ModalDialog title="Administrar usuario" :subtitle="user.name" :busy="sending" @close="emit('close')">
    <div class="user-administration">
    <div class="user-summary"><UserRound :size="22" aria-hidden="true" /><div><strong>{{ user.name }}</strong><p>{{ user.userType }} · {{ user.institutionalId || 'Sin identificador institucional' }}</p></div><StatusBadge :tone="user.trustPercentage >= 80 ? 'info' : 'warning'">{{ user.trustPercentage }} %</StatusBadge></div>
    <nav class="management-tabs" aria-label="Gestión del usuario"><button :aria-pressed="section === 'account'" :disabled="sending" @click="section = 'account'"><ShieldCheck :size="16" aria-hidden="true" /> Cuenta y rol</button><button :aria-pressed="section === 'suspend'" :disabled="sending" @click="section = 'suspend'"><Ban :size="16" aria-hidden="true" /> Suspender</button><button :aria-pressed="section === 'sanctions'" :disabled="sending" @click="section = 'sanctions'"><Scale :size="16" aria-hidden="true" /> Sanciones</button></nav>
    <section v-show="section === 'account'" class="management-section stack">
      <h3>Cuenta, correo y rol de acceso</h3>
      <p class="muted">El tipo institucional no determina los permisos. Consulta la cuenta antes de cambiar su rol.</p>
      <button :disabled="account.loading.value || sending" @click="account.refresh">
        Consultar cuenta</button
      ><RemoteState
        :loading="account.loading.value"
        :error="account.error.value"
        @retry="account.refresh"
        ><template v-if="account.data.value"
           ><div class="account-result"><strong>{{ account.data.value.email }}</strong><p>{{ account.data.value.role }} · <StatusBadge :tone="account.data.value.enabled ? 'success' : 'neutral'">{{ account.data.value.enabled ? 'Acceso habilitado' : 'Acceso deshabilitado' }}</StatusBadge></p></div>
          <details class="muted"><summary>Referencia de la cuenta</summary>{{ account.data.value.id }}</details>
          <form
            v-if="account.data.value.role !== 'ADMINISTRADOR'"
            class="stack"
            @submit.prevent="run('role')"
          >
            <label
              >Nuevo rol<select v-model="role">
                <option>USUARIO</option>
                <option>OPERADOR</option>
              </select></label
            ><p class="muted">Confirma el nuevo permiso de acceso. Las sesiones ya abiertas no se cierran automáticamente.</p><button class="primary" :disabled="sending">Confirmar cambio de rol</button>
          </form>
          <p v-else>Las cuentas administrativas están protegidas en este control.</p></template
        ></RemoteState
      >
    </section>
    <form v-show="section === 'suspend'" class="management-section stack suspension-section" @submit.prevent="run('suspend')">
      <h3>Suspender usuario</h3>
      <p class="suspension-warning">La suspensión restringe los préstamos. No cambia la vinculación institucional ni deshabilita la cuenta de acceso.</p>
      <label>Motivo<textarea v-model="reason" required maxlength="2000" /></label
      ><label>Inicio (hora local)<input v-model="startsAt" type="datetime-local" required /></label
      ><label
        >Fin opcional (vacío: indefinida)<input v-model="endsAt" type="datetime-local" /></label
      ><button class="danger-action" :disabled="sending">Confirmar solicitud de suspensión</button>
    </form>
    <form v-show="section === 'sanctions'" class="management-section stack" @submit.prevent="run('lift')">
      <h3>Levantar sanción</h3>
      <p class="muted">Selecciona una sanción vigente y explica el motivo de la resolución.</p>
      <RemoteState
        :loading="sanctions.loading.value"
        :error="sanctions.error.value"
        @retry="sanctions.refresh"
        ><label
          >Sanción real<select v-model="sanctionId" required>
            <option value="">Seleccionar</option>
            <option
              v-for="s in sanctions.data.value?.filter((item) =>
                ['ACTIVA', 'PROGRAMADA'].includes(item.status),
              )"
              :key="s.id"
              :value="s.id"
            >
              {{ s.id }} · {{ s.status }} · {{ dateTime(s.startsAt) }}
            </option>
          </select></label
        >
        <p v-if="sanctions.data.value?.length === 0">No hay sanciones registradas.</p></RemoteState
      ><label>Fundamento<textarea v-model="resolution" required maxlength="2000" /></label
      ><button class="primary" :disabled="sending || !sanctionId">Confirmar levantamiento</button>
    </form>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
    <button :disabled="sending" @click="emit('close')">Cerrar</button>
    </div>
  </ModalDialog>
</template>
<style scoped>
.user-summary { display: flex; gap: 12px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; }
.user-summary > div { flex: 1; min-width: 0; }
.user-summary strong { font-size: 14px; color: #0f172a; }
.user-summary p { margin-top: 4px; font-size: 11px; color: #64748b; }
.management-tabs { display: flex; gap: 6px; overflow-x: auto; margin: 20px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
.management-tabs button { display: flex; gap: 6px; align-items: center; flex-shrink: 0; font-size: 12px; font-weight: 700; border-color: transparent; }
.management-tabs [aria-pressed='true'] { background: #e8edf4; color: #1e3a5f; }
.management-section { padding: 0 0 20px; }
.management-section h3 { font-size: 15px; font-weight: 800; color: #0f172a; }
.management-section p { font-size: 12px; line-height: 1.6; }
.management-section label { font-size: 12px; font-weight: 600; color: #475569; }
.management-section :is(input,select,textarea) { display: block; width: 100%; margin-top: 6px; font-weight: 400; }
.account-result { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
.account-result strong { font-size: 14px; }
.management-section details { font-size: 11px; }
.suspension-warning { padding: 12px; border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; border-radius: 10px; }
.user-administration .danger-action { color: white; background: #dc2626; border-color: #dc2626; }
@media (max-width: 600px) { .user-summary { flex-wrap: wrap; padding: 12px; } .management-tabs { gap: 0; } .management-tabs button { padding: 8px; } }
</style>
