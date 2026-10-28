<script setup lang="ts">
import { ref } from 'vue'
import { getSession } from '../../auth/api/auth-api'
import {
  listRegistrationRequests,
  approveRequest,
  rejectRequest,
  type RegistrationRequest,
} from '../api/users-admin-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import CreateAccountDialog from '../components/CreateAccountDialog.vue'
import { ApiError } from '../../../shared/api/client'
const session = getSession()!
const status = ref('PENDIENTE'),
  institutionalId = ref(''),
  page = ref(1)
const query = ref({ status: 'PENDIENTE', institutionalId: '', page: '1', limit: '20' })
const requests = useRemote(
  (signal) => listRegistrationRequests(query.value, signal),
  () => JSON.stringify(query.value),
)
const selected = ref<RegistrationRequest | null>(null),
  approve = ref(true),
  reason = ref(''),
  sending = ref(false),
  error = ref(''),
  notice = ref(''),
  uncertain = ref(false)
const account = ref<{ userId: string; name: string } | null>(null)
function load(next = 1) {
  page.value = next
  query.value = {
    status: status.value,
    institutionalId: institutionalId.value.trim(),
    page: String(next),
    limit: '20',
  }
}
function select(item: RegistrationRequest, value: boolean) {
  selected.value = item
  approve.value = value
  reason.value = ''
  error.value = ''
  uncertain.value = false
}
async function confirm() {
  if (!selected.value || sending.value || uncertain.value) return
  sending.value = true
  error.value = ''
  try {
    if (approve.value) {
      const result = await approveRequest(selected.value.id)
      notice.value =
        'Solicitud aprobada. Usuario ' +
        result.user.id +
        '. La cuenta de acceso aún requiere alta por administrador.'
    } else {
      await rejectRequest(selected.value.id, reason.value)
      notice.value = 'Rechazo confirmado.'
    }
    selected.value = null
    await requests.refresh()
  } catch (cause) {
    error.value = errorMessage(cause)
    uncertain.value = cause instanceof ApiError && (cause.status === 0 || cause.status >= 500)
  } finally {
    sending.value = false
  }
}
</script>
<template>
  <h1>Solicitudes de registro</h1>
  <form class="panel row" @submit.prevent="load()">
    <label
      >Estado<select v-model="status">
        <option>PENDIENTE</option>
        <option>APROBADA</option>
        <option>RECHAZADA</option>
        <option value="">Todos</option>
      </select></label
    ><label
      >Identificador institucional exacto<input v-model="institutionalId" maxlength="80" /></label
    ><button>Filtrar solicitudes</button>
  </form>
  <p v-if="notice" class="notice" role="status">{{ notice }}</p>
  <RemoteState
    :loading="requests.loading.value"
    :error="requests.error.value"
    @retry="requests.refresh"
    ><template v-if="requests.data.value"
      ><p>{{ requests.data.value.total }} solicitudes · página {{ page }}</p>
      <div class="cards">
        <article v-for="item in requests.data.value.items" :key="item.id" class="panel stack">
          <h2>{{ item.name }}</h2>
          <span class="badge">{{ item.status }}</span>
          <p>{{ item.userType }} · {{ item.institutionalId || 'Sin identificador' }}</p>
          <ul>
            <li v-for="(evidence, index) in item.evidence" :key="index">
              {{ evidence.information }}
            </li>
          </ul>
          <p v-if="item.rejectionReason">Motivo: {{ item.rejectionReason }}</p>
          <div v-if="item.status === 'PENDIENTE'" class="row">
            <button @click="select(item, true)">Aprobar vinculación</button
            ><button @click="select(item, false)">Rechazar</button>
          </div>
          <button
            v-if="
              session.user.role === 'ADMINISTRADOR' &&
              item.status === 'APROBADA' &&
              item.approvedUserId
            "
            @click="account = { userId: item.approvedUserId, name: item.name }"
          >
            Crear cuenta de acceso
          </button>
        </article>
      </div>
      <p v-if="!requests.data.value.items.length">No hay solicitudes con esos filtros.</p>
      <nav class="row" aria-label="Páginas de solicitudes">
        <button :disabled="page <= 1" @click="load(page - 1)">Anterior</button
        ><button :disabled="page * 20 >= requests.data.value.total" @click="load(page + 1)">
          Siguiente
        </button>
      </nav></template
    ></RemoteState
  >
  <ModalDialog
    v-if="selected"
    :title="approve ? 'Aprobar solicitud' : 'Rechazar solicitud'"
    :busy="sending"
    @close="selected = null"
    ><form class="stack" @submit.prevent="confirm">
      <p>{{ selected.name }} · {{ selected.id }}</p>
      <p v-if="approve">
        Confirma que has revisado la evidencia de vinculación. Esta acción crea un usuario, no una
        cuenta de acceso.
      </p>
      <label v-else>Motivo opcional<textarea v-model="reason" maxlength="500" /></label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="uncertain" class="error">
        Resultado incierto. Consulta la solicitud antes de repetir.
      </p>
      <div class="row">
        <button type="button" :disabled="sending" @click="selected = null">Cerrar</button
        ><button :disabled="sending || uncertain">Confirmar decisión</button>
      </div>
    </form></ModalDialog
  >
  <CreateAccountDialog
    v-if="account"
    :user-id="account.userId"
    :name="account.name"
    @close="account = null"
  />
</template>
