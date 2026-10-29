<script setup lang="ts">
import { computed, ref } from 'vue'
import { listAppeals, resolveAppeal, type Appeal } from '../api/trust-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { dateTime } from '../../../shared/format'
import { ApiError } from '../../../shared/api/client'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import SanctionDetails from '../components/SanctionDetails.vue'
import { getSession } from '../../auth/api/auth-api'
import { useUserDetails } from '../../users/useUserDetails'
import { Check, X, Scale } from '@lucide/vue'
const filter = ref('PENDIENTE')
const page = ref(1)
const canResolve = getSession()?.user.role === 'ADMINISTRADOR'
const remote = useRemote(
  (signal) => listAppeals({ status: filter.value, page: page.value }, signal),
  () => true,
  false,
)
const items = computed(() =>
  [...(remote.data.value?.items ?? [])].sort(
    (a, b) =>
      Number(b.status === 'PENDIENTE') - Number(a.status === 'PENDIENTE') ||
      a.submittedAt.localeCompare(b.submittedAt),
  ),
)
const users = useUserDetails(() => items.value)
async function consult() { page.value = 1; await remote.refresh() }
async function move(delta: number) { page.value += delta; await remote.refresh() }
const statusLabel = (status: Appeal['status']) => ({ PENDIENTE: 'Pendiente', ACEPTADA: 'Aceptada', RECHAZADA: 'Rechazada' })[status]
const selected = ref<Appeal | null>(null),
  outcome = ref<'ACEPTADA' | 'RECHAZADA'>('ACEPTADA'),
  resolution = ref(''),
  sending = ref(false),
  error = ref(''),
  notice = ref(''),
  uncertain = ref(false)
function select(appeal: Appeal, status: 'ACEPTADA' | 'RECHAZADA') {
  selected.value = appeal
  outcome.value = status
  resolution.value = ''
  error.value = ''
  uncertain.value = false
}
async function confirm() {
  if (!canResolve || !selected.value || sending.value || uncertain.value || !resolution.value.trim()) return
  sending.value = true
  error.value = ''
  try {
    const result = await resolveAppeal(selected.value.id, outcome.value, resolution.value)
    notice.value = 'Resolución confirmada: ' + result.status
    selected.value = null
    await remote.refresh()
  } catch (cause) {
    error.value = errorMessage(cause)
    uncertain.value = cause instanceof ApiError && (cause.status === 0 || cause.status >= 500)
  } finally {
    sending.value = false
  }
}
</script>
<template>
  <section class="appeals-page">
  <header class="appeals-heading"><h1>Apelaciones Recibidas</h1>
  <p class="muted">
    Revisa las solicitudes y fundamenta cada decisión.
  </p></header>
  <form class="panel row appeals-filters" @submit.prevent="consult">
    <label
      >Estado<select v-model="filter">
        <option value="PENDIENTE">Pendientes</option>
        <option value="ACEPTADA">Aceptadas</option>
        <option value="RECHAZADA">Rechazadas</option>
        <option value="">Todos</option>
      </select></label
    ><button :disabled="remote.loading.value">Consultar bandeja</button
    ><strong>{{
      remote.data.value ? remote.data.value.total + ' apelaciones' : 'Cantidad desconocida'
    }}</strong>
  </form>
  <p v-if="notice" role="status" class="notice">{{ notice }}</p>
  <p v-if="!remote.data.value && !remote.error.value" class="inbox-intro"><Scale :size="24" aria-hidden="true" /> Consulta la bandeja para revisar las apelaciones recibidas.</p>
  <RemoteState :loading="remote.loading.value" :error="remote.error.value" @retry="remote.refresh"
    ><div class="appeals-list">
      <article v-for="appeal in items" :key="appeal.id" class="panel appeal-card" :class="{ resolved: appeal.status !== 'PENDIENTE' }">
        <div class="appeal-card-heading"><div><h2>{{ users[appeal.userId]?.name || 'Usuario ' + appeal.userId }}</h2><p class="muted">{{ users[appeal.userId]?.institutionalId || 'Identificador institucional no disponible' }}</p></div><StatusBadge :tone="appeal.status === 'PENDIENTE' ? 'warning' : appeal.status === 'ACEPTADA' ? 'success' : 'danger'">{{ statusLabel(appeal.status) }}</StatusBadge></div>
        <div class="appeal-metadata"><div><span>Fecha de apelación</span><p>{{ dateTime(appeal.submittedAt) }}</p></div><div><span>Sanción vinculada</span><p>{{ appeal.sanctionId ? 'Sanción registrada' : 'Sin referencia de sanción' }}</p></div></div>
        <div class="appeal-argument"><h3>Argumento del apelante</h3><p>{{ appeal.reason }}</p></div>
        <details v-if="appeal.sanctionId" class="sanction-query"><summary>Consultar sanción original</summary><SanctionDetails :sanction-id="appeal.sanctionId" /></details>
        <div v-if="appeal.resolution" class="appeal-resolution"><h3>Resolución</h3><p>{{ appeal.resolution }}</p></div>
        <details class="appeal-reference"><summary>Referencias de la apelación</summary><p>Apelación: {{ appeal.id }}</p><p>Usuario: {{ appeal.userId }}</p><p v-if="appeal.sanctionId">Sanción: {{ appeal.sanctionId }}</p></details>
        <div v-if="canResolve && appeal.status === 'PENDIENTE'" class="appeal-actions">
          <button class="reject-action" @click="select(appeal, 'RECHAZADA')"><X :size="16" aria-hidden="true" /> Rechazar</button>
          <button class="primary" @click="select(appeal, 'ACEPTADA')"><Check :size="16" aria-hidden="true" /> Aprobar apelación</button>
        </div>
      </article>
    </div>
    <p v-if="remote.data.value && !items.length" class="panel">
      No hay apelaciones en la respuesta recibida.
    </p></RemoteState
  >
  <nav v-if="remote.data.value" class="row" aria-label="Páginas de apelaciones"><button :disabled="remote.loading.value || page <= 1" @click="move(-1)">Anterior</button><span>Página {{ remote.data.value.page }}</span><button :disabled="remote.loading.value || page * remote.data.value.limit >= remote.data.value.total" @click="move(1)">Siguiente</button></nav>
  <ModalDialog
    v-if="selected"
    :title="outcome === 'ACEPTADA' ? 'Aprobar apelación' : 'Rechazar apelación'"
    :subtitle="users[selected.userId]?.name || 'Usuario ' + selected.userId"
    :busy="sending"
    @close="selected = null"
    ><form class="stack resolution-form" @submit.prevent="confirm">
      <div class="appeal-argument"><h3>Argumento del apelante</h3><p>{{ selected.reason }}</p></div>
      <p class="resolution-effect">{{ outcome === 'ACEPTADA' ? 'La aceptación absuelve únicamente la sanción vinculada.' : 'La sanción vinculada se mantiene al rechazar la apelación.' }}</p>
      <label
        >Fundamento obligatorio<textarea
          v-model="resolution"
          required
          maxlength="2000"
          rows="5"
          :disabled="sending"
        />
      </label>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="uncertain" class="error">
        Resultado incierto. No vuelvas a resolver sin consultar el estado.
      </p>
      <div class="row">
        <button type="button" :disabled="sending" @click="selected = null">Cerrar</button
        ><button :class="outcome === 'ACEPTADA' ? 'primary' : 'reject-action'" :disabled="sending || uncertain || !resolution.trim()">
          Confirmar resolución
        </button>
      </div>
    </form></ModalDialog
  >
  </section>
</template>
<style scoped>
.appeals-heading { margin-bottom: 28px; }
.appeals-heading h1 { margin-bottom: 8px; letter-spacing: -.025em; }
.appeals-heading p { font-size: 14px; }
.appeals-filters { align-items: end; padding: 16px 20px; }
.appeals-filters label { display: grid; gap: 6px; font-size: 12px; font-weight: 600; color: #64748b; }
.appeals-filters strong { margin-left: auto; align-self: center; font-size: 12px; color: #64748b; }
.inbox-intro { display: flex; align-items: center; gap: 12px; padding: 24px; color: #64748b; font-size: 14px; }
.appeals-list { display: grid; gap: 20px; }
.appeal-card { padding: 28px 32px; margin: 0; border-radius: 16px; box-shadow: 0 1px 3px #0f172a08; }
.appeal-card.resolved { background: #fcfcfd; }
.appeal-card-heading { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
.appeal-card-heading h2 { margin: 0 0 4px; font-size: 20px; }
.appeal-card-heading > div { min-width: 0; }
.appeal-card-heading p { font-size: 12px; }
.appeal-metadata { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 24px 0; padding: 16px; border: 1px solid #f1f5f9; border-radius: 12px; background: #f8fafc; }
.appeal-metadata span, .appeal-argument h3, .appeal-resolution h3 { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
.appeal-metadata p { margin-top: 6px; font-size: 13px; }
.appeal-argument { padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
.appeal-argument p { border-left: 4px solid #cbd5e1; padding-left: 16px; margin-top: 12px; font-size: 14px; line-height: 1.65; white-space: pre-wrap; font-style: italic; color: #475569; }
.appeal-resolution { margin-top: 16px; font-size: 14px; white-space: pre-wrap; }
.appeal-reference { margin: 16px 0; font-size: 11px; color: #64748b; }
.sanction-query { margin: 16px 0; font-size: 12px; color: #1e3a5f; }
.sanction-query > summary { cursor: pointer; font-weight: 600; }
.appeal-actions { display: flex; justify-content: end; gap: 12px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
.appeal-actions button { display: inline-flex; justify-content: center; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 10px; }
.appeals-page .reject-action { color: #dc2626; border-color: #fecaca; background: #fff; }
.resolution-form .reject-action { background: #dc2626; border-color: #dc2626; color: white; }
.resolution-form label { font-size: 12px; font-weight: 700; color: #64748b; }
.resolution-form textarea { width: 100%; margin-top: 8px; }
.resolution-form .row { justify-content: end; border-top: 1px solid #e2e8f0; padding-top: 16px; }
.resolution-effect { font-size: 12px; line-height: 1.6; color: #64748b; }
@media (max-width: 1023px) { .appeal-card { padding: 18px; } .appeal-card-heading h2 { font-size: 15px; } .appeal-metadata { margin: 14px 0; padding: 12px; grid-template-columns: 1fr; gap: 0; } .appeal-metadata > div:nth-child(2) { display: none; } .appeal-metadata p { font-size: 11px; } .appeal-argument { padding: 14px; } .appeal-argument p { font-size: 13px; } .appeal-actions button { flex: 1; padding: 10px; font-size: 12px; } }
@media (max-width: 375px) { .appeal-metadata { grid-template-columns: 1fr; } .appeal-card-heading { flex-wrap: wrap; gap: 8px; } .appeals-filters strong { margin-left: 0; } }
</style>
