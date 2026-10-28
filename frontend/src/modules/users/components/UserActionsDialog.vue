<script setup lang="ts">
import { ref } from 'vue'
import { findAccount, updateRole } from '../api/users-admin-api'
import { getSanctions, type UserProfile } from '../api/student-api'
import { suspendUser, liftSanction } from '../../trust/api/trust-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { dateTime } from '../../../shared/format'
const props = defineProps<{ user: UserProfile }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const account = useRemote(
  (signal) => findAccount(props.user.id, signal),
  () => true,
  false,
)
const sanctions = useRemote((signal) => getSanctions(props.user.id, signal))
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
  <ModalDialog :title="'Gestionar ' + user.name" :busy="sending" @close="emit('close')">
    <p>Tipo institucional {{ user.userType }} no equivale a rol de acceso.</p>
    <section class="panel stack">
      <h3>Cuenta, correo y rol</h3>
      <button :disabled="account.loading.value || sending" @click="account.refresh">
        Consultar cuenta · F10 pendiente</button
      ><RemoteState
        :loading="account.loading.value"
        :error="account.error.value"
        @retry="account.refresh"
        ><template v-if="account.data.value"
          ><p>
            {{ account.data.value.email }} · {{ account.data.value.role }} ·
            {{ account.data.value.enabled ? 'Acceso habilitado' : 'Acceso deshabilitado' }}
          </p>
          <p class="muted">Cuenta {{ account.data.value.id }}</p>
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
            ><button :disabled="sending">Confirmar cambio de rol</button>
          </form>
          <p v-else>Las cuentas administrativas están protegidas en este control.</p></template
        ></RemoteState
      >
    </section>
    <form class="panel stack" @submit.prevent="run('suspend')">
      <h3>Suspender · F11 pendiente</h3>
      <p>No modifica la vinculación ni deshabilita la cuenta como sustituto de una sanción.</p>
      <label>Motivo<textarea v-model="reason" required maxlength="2000" /></label
      ><label>Inicio (hora local)<input v-model="startsAt" type="datetime-local" required /></label
      ><label
        >Fin opcional (vacío: indefinida)<input v-model="endsAt" type="datetime-local" /></label
      ><button :disabled="sending">Confirmar solicitud de suspensión</button>
    </form>
    <form class="panel stack" @submit.prevent="run('lift')">
      <h3>Levantar sanción · F12 pendiente</h3>
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
      ><button :disabled="sending || !sanctionId">Confirmar levantamiento</button>
    </form>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
    <button :disabled="sending" @click="emit('close')">Cerrar</button>
  </ModalDialog>
</template>
