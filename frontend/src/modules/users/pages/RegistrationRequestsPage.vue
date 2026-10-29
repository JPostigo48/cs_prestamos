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
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import { ClipboardList, Filter, Check, X } from '@lucide/vue'
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
  <section class="registration-page">
  <header class="requests-heading"><div><h1>Solicitudes de registro</h1><p class="muted">Revisa la vinculación institucional antes de aprobar una solicitud.</p></div><RouterLink to="/app/loans">Volver al panel</RouterLink></header>
  <form class="panel row request-filters" @submit.prevent="load()">
    <label
      >Estado<select v-model="status">
        <option value="PENDIENTE">Pendientes</option>
        <option value="APROBADA">Aprobadas</option>
        <option value="RECHAZADA">Rechazadas</option>
        <option value="">Todos</option>
      </select></label
    ><label
      >Identificador institucional exacto<input v-model="institutionalId" maxlength="80" placeholder="Buscar por identificador" /></label
    ><button class="primary"><Filter :size="16" aria-hidden="true" />Filtrar solicitudes</button>
  </form>
  <p v-if="notice" class="notice" role="status">{{ notice }}</p>
  <RemoteState
    :loading="requests.loading.value"
    :error="requests.error.value"
    @retry="requests.refresh"
    ><template v-if="requests.data.value"
       ><p class="requests-count">{{ requests.data.value.total }} solicitudes · página {{ page }}</p>
       <div class="request-list">
         <article v-for="item in requests.data.value.items" :key="item.id" class="panel request-card">
           <div class="request-identity"><h2>{{ item.name }}</h2>
           <p>{{ item.userType.replaceAll('_', ' ') }} · {{ item.institutionalId || 'Sin identificador' }}</p></div>
           <StatusBadge :tone="item.status === 'PENDIENTE' ? 'warning' : item.status === 'APROBADA' ? 'success' : 'danger'">{{ item.status }}</StatusBadge>
           <details class="request-evidence"><summary><ClipboardList :size="16" aria-hidden="true" />Revisar evidencia de vinculación</summary><ul>
            <li v-for="(evidence, index) in item.evidence" :key="index">
              <img v-if="/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(evidence.information)" :src="evidence.information" alt="Evidencia de vinculación presentada por el solicitante" class="max-h-64 max-w-full object-contain" />
              <template v-else>{{ evidence.information }}</template>
            </li>
           </ul><p v-if="!item.evidence.length">No se adjuntó información de vinculación.</p></details>
           <p v-if="item.rejectionReason" class="request-reason">Motivo: {{ item.rejectionReason }}</p>
           <div v-if="item.status === 'PENDIENTE'" class="row request-actions">
             <button class="approve-request" @click="select(item, true)"><Check :size="16" aria-hidden="true" />Aprobar vinculación</button
             ><button class="reject-request" @click="select(item, false)"><X :size="16" aria-hidden="true" />Rechazar</button>
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
       <p v-if="!requests.data.value.items.length" class="panel requests-empty">No hay solicitudes con esos filtros.</p>
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
    :subtitle="selected.name"
    compact
    @close="selected = null"
    ><form class="stack" @submit.prevent="confirm">
       <p class="muted">Solicitud {{ selected.id }}</p>
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
         ><button class="primary" :disabled="sending || uncertain">{{ sending ? 'Procesando…' : 'Confirmar decisión' }}</button>
      </div>
    </form></ModalDialog
  >
  <CreateAccountDialog
    v-if="account"
    :user-id="account.userId"
    :name="account.name"
    @close="account = null"
  />
  </section>
</template>
<style scoped>
.requests-heading { display: flex; justify-content: space-between; align-items: start; gap: 16px; margin-bottom: 24px; }
.application .requests-heading h1 { margin-bottom: 8px; }
.requests-heading p, .requests-heading a { font-size: 14px; }
.requests-heading a { flex-shrink: 0; color: #2563eb; padding-top: 8px; }
.request-filters { align-items: end; gap: 16px; }
.request-filters label { display: grid; gap: 6px; font-size: 12px; font-weight: 600; color: #475569; }
.request-filters label:nth-child(2) { flex: 1; min-width: min(100%,240px); }
.application .request-filters :is(input,select) { height: 40px; font-size: 14px; font-weight: 400; padding: 8px 12px; }
.application .request-filters button { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; height: 40px; font-weight: 700; }
.requests-count { color: #64748b; font-size: 12px; margin-bottom: 16px; }
.request-list { display: grid; gap: 12px; }
.application .request-card { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px 24px; margin: 0; padding: 20px; border-radius: 12px; box-shadow: 0 1px 2px #0f172a0d; }
.application .request-identity h2 { font-size: 14px; margin: 0 0 4px; }
.request-identity p { font-size: 12px; color: #64748b; }
.request-card > .status-badge { align-self: start; justify-self: end; font-size: 10px; border-radius: 6px; }
.request-evidence { grid-column: 1; font-size: 12px; color: #475569; line-height: 1.7; }
.request-evidence summary { color: #2563eb; cursor: pointer; font-weight: 600; }
.request-evidence summary svg { display: inline; vertical-align: middle; margin-right: 6px; }
.request-evidence ul { list-style: disc; padding-left: 20px; margin-top: 10px; }
.request-reason { grid-column: 1; font-size: 13px; }
.request-actions { grid-column: 2; grid-row: 2 / span 2; align-self: center; flex-direction: row-reverse; }
.application .request-actions { align-items: stretch; }
.application .request-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 700; padding: 10px 14px; }
.application .approve-request { background: #16a34a; color: white; border-color: #16a34a; }
.application .approve-request:hover { background: #15803d; }
.application .reject-request { background: #fef2f2; color: #dc2626; border-color: #fee2e2; }
.application .reject-request:hover { background: #fee2e2; }
.requests-empty { padding: 40px; text-align: center; color: #64748b; }
.registration-page nav { margin-top: 24px; justify-content: end; font-size: 13px; }
@media (max-width: 767px) {
 .requests-heading { flex-direction: column; gap: 8px; }
 .application .request-card { padding: 16px; gap: 12px; }
 .request-actions { grid-row: auto; grid-column: 1 / -1; flex-wrap: wrap; }
 .request-actions button { flex: 1; }
 .request-evidence, .request-reason { grid-column: 1 / -1; }
 .request-filters label, .request-filters button { width: 100%; }
}
</style>
