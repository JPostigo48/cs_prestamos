<script setup lang="ts">
import { computed, ref } from 'vue'
import { listUsers } from '../api/users-admin-api'
import type { UserProfile } from '../api/student-api'
import UserHistoryDialog from '../components/UserHistoryDialog.vue'
import UserActionsDialog from '../components/UserActionsDialog.vue'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
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
  <h1>Usuarios</h1>
  <RouterLink to="/app/registrations">Revisar solicitudes de registro y alta de cuentas</RouterLink>
  <form class="panel row" @submit.prevent="load()">
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
    ><label>Identificador exacto<input v-model="institutionalId" maxlength="80" /></label
    ><button>Aplicar filtros</button
    ><label>Nombre en esta página<input v-model="search" type="search" /></label>
  </form>
  <RemoteState :loading="users.loading.value" :error="users.error.value" @retry="users.refresh"
    ><template v-if="users.data.value"
      ><p>{{ users.data.value.total }} usuarios · página {{ page }}</p>
      <div class="panel table-wrap desktop-only">
        <table>
          <caption class="muted">
            Correo, rol y cuenta requieren consulta individual F10; teléfono no disponible.
          </caption>
          <thead>
            <tr>
              <th>Usuario</th>
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
                <span class="badge">{{
                  user.hasCurrentAffiliation ? 'Vigente' : 'No vigente'
                }}</span>
              </td>
              <td>{{ user.trustPercentage }} %</td>
              <td>
                <div class="row">
                  <button @click="history = user">Historial</button
                  ><button @click="actions = user">Cuenta, rol y sanciones</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!filtered.length">No hay usuarios que coincidan en esta página.</p>
      </div>
      <div class="mobile-only">
        <article v-for="user in filtered" :key="user.id" class="panel stack">
          <h2>{{ user.name }}</h2>
          <p class="muted">{{ user.institutionalId || 'Sin identificador institucional' }} · {{ user.userType }}</p>
          <p><span class="badge">{{ user.hasCurrentAffiliation ? 'Vinculación vigente' : 'Vinculación no vigente' }}</span> · Confianza {{ user.trustPercentage }} %</p>
          <div class="row"><button @click="history = user">Historial</button><button @click="actions = user">Cuenta, rol y sanciones</button></div>
        </article>
        <p v-if="!filtered.length" class="panel">No hay usuarios que coincidan en esta página.</p>
        <p class="muted">Correo y rol requieren consulta individual F10; teléfono no disponible.</p>
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
</template>
