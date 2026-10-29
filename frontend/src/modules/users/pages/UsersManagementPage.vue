<script setup lang="ts">
import { computed, ref } from 'vue'
import { listUsers } from '../api/users-admin-api'
import type { UserProfile } from '../api/student-api'
import UserHistoryDialog from '../components/UserHistoryDialog.vue'
import UserActionsDialog from '../components/UserActionsDialog.vue'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import { History, Search, Settings2, UserPlus } from '@lucide/vue'
const type = ref(''),
  affiliation = ref(''),
  institutionalId = ref(''),
  search = ref(''),
  page = ref(1)
const query = ref({
  page: '1',
  limit: '20',
  userType: '',
  vinculacionVigente: '',
  institutionalId: '',
})
const users = useRemote(
  (signal) => listUsers(query.value, signal),
  () => JSON.stringify(query.value),
)
const filtered = computed(
  () =>
    users.data.value?.items.filter((u) =>
      u.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()),
    ) ?? [],
)
const history = ref<UserProfile | null>(null),
  actions = ref<UserProfile | null>(null)
function load(next = 1) {
  page.value = next
  query.value = {
    page: String(next),
    limit: '20',
    userType: type.value,
    vinculacionVigente: affiliation.value,
    institutionalId: institutionalId.value.trim(),
  }
}
</script>
<template>
  <section class="users-page">
  <header class="users-heading">
    <div><h1>Gestión de Usuarios</h1><p class="muted">Consulta historiales, administra cuentas y gestiona sanciones.</p></div>
    <RouterLink class="registration-link" to="/app/registrations"><UserPlus :size="18" aria-hidden="true" /> Solicitudes y alta de cuentas</RouterLink>
  </header>
  <form class="panel row users-filters" @submit.prevent="load()">
    <label
      >Tipo<select v-model="type">
        <option value="">Todos</option>
        <option>ESTUDIANTE</option>
        <option>DOCENTE</option>
        <option>ADMINISTRATIVO</option>
      </select></label
    ><label
      >Vinculación<select v-model="affiliation">
        <option value="">Todas</option>
        <option value="true">Vigente</option>
        <option value="false">No vigente</option>
      </select></label
    ><label>Identificador institucional exacto<input v-model="institutionalId" maxlength="80" /></label
    ><button>Aplicar filtros</button
     ><label class="name-search">Nombre en esta página<span><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Buscar usuario…" /></span></label>
  </form>
  <RemoteState :loading="users.loading.value" :error="users.error.value" @retry="users.refresh"
    ><template v-if="users.data.value"
      ><p>{{ users.data.value.total }} usuarios · página {{ page }}</p>
      <div class="panel table-wrap desktop-only users-table" tabindex="0" role="region" aria-label="Listado de usuarios">
        <table>
          <caption class="muted">
            Consulta la cuenta de cada usuario para conocer su correo y rol de acceso; teléfono no disponible.
          </caption>
          <thead>
            <tr>
               <th>Información del usuario</th>
              <th>Tipo</th>
              <th>Vinculación</th>
              <th>Confianza</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in filtered" :key="user.id">
              <td>
                <strong>{{ user.name }}</strong>
                <p class="muted">{{ user.institutionalId || 'Sin identificador institucional' }}</p>
              </td>
              <td>{{ user.userType }}</td>
              <td>
                <StatusBadge :tone="user.hasCurrentAffiliation ? 'success' : 'neutral'">{{
                  user.hasCurrentAffiliation ? 'Vigente' : 'No vigente'
                }}</StatusBadge>
              </td>
              <td><StatusBadge :tone="user.trustPercentage >= 80 ? 'info' : user.trustPercentage >= 50 ? 'warning' : 'danger'">{{ user.trustPercentage }} %</StatusBadge></td>
              <td>
                <div class="row">
                  <button class="history-link" @click="history = user"><History :size="16" aria-hidden="true" /> Historial</button
                  ><button class="manage-button" @click="actions = user"><Settings2 :size="16" aria-hidden="true" /> Cuenta, rol y sanciones</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!filtered.length">No hay usuarios que coincidan en esta página.</p>
      </div>
      <div class="mobile-only">
        <article v-for="user in filtered" :key="user.id" class="panel user-card">
          <div class="user-card-heading"><div><h2>{{ user.name }}</h2><p class="muted">{{ user.institutionalId || 'Sin identificador institucional' }}</p></div><button class="history-link" @click="history = user"><History :size="15" aria-hidden="true" /> Historial</button></div>
          <p class="user-card-meta"><StatusBadge :tone="user.hasCurrentAffiliation ? 'success' : 'neutral'">{{ user.hasCurrentAffiliation ? 'Vinculación vigente' : 'No vigente' }}</StatusBadge><span>{{ user.userType }}</span></p>
          <div class="user-card-footer"><StatusBadge :tone="user.trustPercentage >= 80 ? 'info' : user.trustPercentage >= 50 ? 'warning' : 'danger'">{{ user.trustPercentage }} % confianza</StatusBadge><button class="manage-button" @click="actions = user"><Settings2 :size="16" aria-hidden="true" /> Cuenta, rol y sanciones</button></div>
        </article>
        <p v-if="!filtered.length" class="panel">No hay usuarios que coincidan en esta página.</p>
        <p class="muted account-help">Consulta la cuenta individual para conocer el correo y rol de acceso; teléfono no disponible.</p>
      </div>
      <nav class="row" aria-label="Páginas de usuarios">
        <button :disabled="page <= 1" @click="load(page - 1)">Anterior</button
        ><button :disabled="page * 20 >= users.data.value.total" @click="load(page + 1)">
          Siguiente
        </button>
      </nav></template
    ></RemoteState
  >
  <UserHistoryDialog
    v-if="history"
    :user-id="history.id"
    :name="history.name"
    @close="history = null"
  /><UserActionsDialog
    v-if="actions"
    :user="actions"
    @close="actions = null"
    @changed="users.refresh"
  />
  </section>
</template>
<style scoped>
.users-heading { display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 20px; margin-bottom: 28px; }
.users-heading h1 { margin: 0 0 8px; letter-spacing: -.025em; }
.users-heading p { font-size: 14px; }
.registration-link { display: inline-flex; align-items: center; gap: 8px; color: #1e3a5f; font-size: 13px; font-weight: 700; }
.users-filters { align-items: end; padding: 20px; gap: 16px; }
.users-filters label { display: grid; gap: 6px; font-size: 12px; color: #64748b; font-weight: 600; flex: 1 1 160px; }
.users-filters .name-search { flex-basis: 220px; }
.name-search span { position: relative; }
.name-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); }
.users-filters .name-search input { padding-left: 36px; width: 100%; }
.users-table { padding: 0; border-radius: 16px; box-shadow: 0 1px 3px #0f172a08; }
.users-table table { min-width: 860px; }
.users-table caption { caption-side: bottom; text-align: left; padding: 14px 24px; font-size: 12px; }
.users-table :is(td,th) { padding: 20px 24px; }
.users-table strong { font-size: 16px; color: #0f172a; }
.users-table td p { margin-top: 4px; font-size: 12px; }
.users-table tbody tr:hover { background: #f8fafc; }
.history-link, .manage-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 700; }
.users-page .history-link { color: #2563eb; border-color: transparent; background: transparent; padding: 6px 0; }
.users-page .manage-button { color: #1e3a5f; background: #f8fafc; border-color: #cbd5e1; }
.user-card { padding: 16px; box-shadow: 0 1px 2px #0f172a08; }
.user-card-heading { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
.user-card-heading > div { min-width: 0; }
.user-card h2 { margin: 0 0 4px; font-size: 14px; }
.user-card p, .account-help { font-size: 12px; }
.user-card-heading .history-link { flex-shrink: 0; }
.user-card-meta, .user-card-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; }
.user-card-meta > span:last-child { font-size: 10px; color: #64748b; }
.user-card-footer { padding-top: 12px; border-top: 1px solid #f1f5f9; }
@media (max-width: 600px) {
  .users-heading { gap: 10px; margin-bottom: 16px; }
  .application .users-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 12px; gap: 10px; }
  .users-filters label { gap: 4px; }
  .users-filters > label:nth-child(3) { min-width: 0; }
  .users-filters .name-search { grid-column: 1 / -1; }
  .application .users-filters > button { font-size: 12px; min-height: 38px; padding-inline: 10px; }
  .user-card-footer .manage-button { width: 100%; }
}
</style>
