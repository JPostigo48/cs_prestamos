<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getSession } from '../../auth/api/auth-api'
import {
  getEligibility,
  getHistory,
  getSanctions,
  getTrust,
  getUser,
  submitAppeal,
  appealBlocked,
  confirmedAppeal,
  appealDraft,
  type Sanction,
} from '../api/student-api'
import { categoryAvailability, getGlobalAvailability, getCategories, getCopy, type CopyDetail } from '../../inventory/api/inventory-api'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { canAppeal } from '../appeal-policy'
import ContractSection from '../../../shared/components/ContractSection.vue'
import { dateTime } from '../../../shared/format'
const eligibilityReasons: Record<string, string> = {
  VINCULACION_NO_VIGENTE: 'Vinculación institucional no vigente',
  SANCION_ACTIVA: 'Sanción activa',
}

const session = getSession()!
const profile = useRemote((signal) => getUser(session.user.id, signal))
const eligibility = useRemote((signal) => getEligibility(session.user.id, signal))
const trust = useRemote((signal) => getTrust(session.user.id, signal))
const sanctions = useRemote((signal) => getSanctions(session.user.id, signal))
const loans = useRemote((signal) => getHistory(session.user.id, signal))
const categories = useRemote(getCategories)
const availability = useRemote(getGlobalAvailability)
const copies = ref<Record<string, CopyDetail>>({})
const controller = new AbortController()
watch(loans.data, (list) => {
  for (const id of new Set(list?.map((loan) => loan.copyId))) {
    if (!copies.value[id])
      void getCopy(id, controller.signal)
        .then((copy) => {
          copies.value[id] = copy
        })
        .catch(() => {
          /* El identificador sigue visible. */
        })
  }
})
onBeforeUnmount(() => controller.abort())
const currentLoans = computed(
  () => loans.data.value?.filter((loan) => loan.status !== 'FINALIZADO') ?? [],
)
const appealing = ref<Sanction | null>(null)
const reason = ref('')
const appealError = ref('')
const sending = ref(false)
const notice = ref('')
const date = dateTime
function openAppeal(sanction: Sanction) {
  if (confirmedAppeal(sanction.id)) return
  appealing.value = sanction
  reason.value = appealDraft(sanction.id) ?? ''
  appealError.value = ''
}
async function sendAppeal() {
  if (!appealing.value || sending.value || !reason.value.trim() || appealBlocked(appealing.value.id)) return
  sending.value = true
  appealError.value = ''
  try {
    const confirmation = await submitAppeal(appealing.value.id, reason.value.trim())
    appealing.value = null
    notice.value = 'Apelación ' + confirmation.id + ' confirmada como PENDIENTE para revisión.'
  } catch (cause) {
    appealError.value = errorMessage(cause)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="student-welcome">
    <p class="muted greeting">Bienvenido/a,</p>
    <h1>{{ profile.data.value?.name || 'Mi cuenta' }}</h1>
    <div class="student-status">
      <div aria-label="Perfil">
      <RemoteState
        :loading="profile.loading.value"
        :error="profile.error.value"
        @retry="profile.refresh"
        ><details><summary>Perfil</summary><p>
          {{ profile.data.value?.name || session.user.email }} · {{ profile.data.value?.userType }}
        </p></details></RemoteState
      >
      </div>
      <div aria-label="Habilitación para préstamos">
      <RemoteState
        :loading="eligibility.loading.value"
        :error="eligibility.error.value"
        @retry="eligibility.refresh"
      >
        <details><summary class="badge">
          {{
            eligibility.data.value?.enabled
              ? 'Habilitado por vinculación y sanciones'
              : 'No habilitado para préstamos'
          }}
        </summary>
        <p>Habilitación para préstamos; no indica el estado de la cuenta de acceso.</p>
        <p class="muted">La reserva también valida términos, cupo y disponibilidad.</p>
        <ul>
          <li v-for="item in eligibility.data.value?.reasons" :key="item">
            {{ eligibilityReasons[item] || item }}
          </li>
        </ul></details>
      </RemoteState>
      </div>
      <div aria-label="Confianza">
      <RemoteState :loading="trust.loading.value" :error="trust.error.value" @retry="trust.refresh"
        ><p v-if="trust.data.value" class="badge">
          Confianza: {{ trust.data.value.percentage }} % · {{ trust.data.value.level.replaceAll('_', ' ') }}
        </p></RemoteState
      >
      </div>
    </div>
  </section>
  <p v-if="notice" class="notice" role="status">{{ notice }}</p>
  <section v-for="sanction in sanctions.data.value?.filter(item => item.status === 'ACTIVA')" :key="sanction.id" class="panel active-sanction" aria-label="Sanción activa">
    <h2>Sanción activa</h2>
    <p>Vigente desde {{ date(sanction.startsAt) }} hasta {{ sanction.endsAt ? date(sanction.endsAt) : 'sin fecha registrada' }}.</p>
    <p v-if="confirmedAppeal(sanction.id)" role="status">Apelación {{ confirmedAppeal(sanction.id)?.id }} · PENDIENTE</p>
    <button v-if="canAppeal(sanction)" :disabled="appealBlocked(sanction.id)" @click="openAppeal(sanction)">Apelar sanción</button>
    <p>Los detalles y las apelaciones están disponibles en el historial de sanciones.</p>
  </section>
  <section class="student-catalog">
    <div class="student-section-heading"><h2>Explorar catálogo</h2><RouterLink to="/app/catalog">Ver todo</RouterLink></div>
    <RemoteState
      :loading="categories.loading.value"
      :error="categories.error.value"
      @retry="categories.refresh"
    >
      <ul class="category-grid">
        <li v-for="category in categories.data.value" :key="category.id" class="category-card">
          <h3>
            <RouterLink :to="{ path: '/app/catalog', query: { categoryId: category.id } }">{{
              category.nombre
            }}</RouterLink>
          </h3>
          <p class="availability-count" :aria-label="`${categoryAvailability(availability.error.value ? null : availability.data.value, category.id) ?? 'Desconocido'} ejemplares disponibles`">{{ categoryAvailability(availability.error.value ? null : availability.data.value, category.id) ?? 'Desconocido' }} <span class="desktop-only">ejemplares disponibles</span><span class="mobile-only" aria-hidden="true">disp.</span></p>
          <p class="muted category-resources">{{ category.resourceCount }} recursos <span class="desktop-only">registrados</span></p>
        </li>
      </ul>
      <p v-if="categories.data.value?.length === 0">No hay categorías registradas.</p>
    </RemoteState>
    <p v-if="availability.error.value" class="error" role="alert">Disponibilidad desconocida. {{ availability.error.value }} <button @click="availability.refresh">Reintentar disponibilidad</button></p>
  </section>
  <section class="student-loans">
    <div class="student-section-heading"><h2>Mis préstamos activos</h2><span class="muted">{{ loans.data.value ? currentLoans.length : '—' }} activos</span></div>
    <RemoteState :loading="loans.loading.value" :error="loans.error.value" @retry="loans.refresh">
      <div v-if="currentLoans.length" class="table-wrap desktop-only student-loan-table">
        <table>
          <caption>Préstamos activos y planificados de mi cuenta</caption>
          <thead><tr><th scope="col">Recurso y ejemplar</th><th scope="col">Vencimiento / inicio</th><th scope="col">Estado</th></tr></thead>
          <tbody><tr v-for="loan in currentLoans" :key="loan.id">
            <td><RouterLink v-if="copies[loan.copyId]" :to="'/app/catalog/' + copies[loan.copyId]!.recurso.id">{{ copies[loan.copyId]!.recurso.nombre }}</RouterLink><span v-else>{{ loan.copyId }}</span><p class="muted">{{ copies[loan.copyId]?.codigoInventario || loan.copyId }}</p></td>
            <td><p>Hasta {{ date(loan.endsAt) }}</p><p class="muted loan-start">Inicio: {{ date(loan.startsAt) }}</p></td>
            <td><span class="badge">{{ loan.status }}</span><strong v-if="loan.status === 'ACTIVO' && new Date(loan.endsAt).getTime() < Date.now()"> · En mora</strong></td>
          </tr></tbody>
        </table>
      </div>
      <article v-for="loan in currentLoans" :key="loan.id" class="panel mobile-only student-loan-card">
        <h3>
          <RouterLink
            v-if="copies[loan.copyId]"
            :to="'/app/catalog/' + copies[loan.copyId]!.recurso.id"
            >{{ copies[loan.copyId]!.recurso.nombre }}</RouterLink
          ><span v-else>Ejemplar {{ loan.copyId }}</span>
        </h3>
        <p>
          {{ copies[loan.copyId]?.codigoInventario || loan.copyId }} ·
          <span class="badge">{{ loan.status }}</span
          ><strong v-if="loan.status === 'ACTIVO' && new Date(loan.endsAt).getTime() < Date.now()">
            · En mora</strong
          >
        </p>
        <p>Hasta {{ date(loan.endsAt) }}</p>
        <details><summary>Fecha de inicio</summary><p>{{ date(loan.startsAt) }}</p></details>
      </article>
      <p v-if="!currentLoans.length" class="panel">No tienes préstamos activos ni planificados.</p>
      <details v-if="loans.data.value?.some((loan) => loan.status === 'FINALIZADO')">
        <summary>Historial de préstamos finalizados</summary>
        <p
          v-for="loan in loans.data.value.filter((item) => item.status === 'FINALIZADO')"
          :key="loan.id"
        >
          {{ copies[loan.copyId]?.recurso.nombre || loan.copyId }} ·
          {{ loan.return ? date(loan.return.returnedAt) : 'Sin fecha de devolución' }}
        </p>
      </details>
    </RemoteState>
  </section>
  <section class="panel">
    <h2>Historial de sanciones</h2>
    <RemoteState
      :loading="sanctions.loading.value"
      :error="sanctions.error.value"
      @retry="sanctions.refresh"
    >
      <article v-for="sanction in sanctions.data.value" :key="sanction.id" class="panel stack">
        <h3>Sanción {{ sanction.status }}</h3>
        <p>
          Desde {{ date(sanction.startsAt) }} hasta
          {{ sanction.endsAt ? date(sanction.endsAt) : 'sin fecha registrada' }}
        </p>
        <p>Confianza: {{ sanction.previousTrust }} % → {{ sanction.resultingTrust }} %</p>
        <ContractSection
          :key="sanction.id"
          title="Motivo y detalles de la sanción"
          contract="F05"
          :params="{ sanctionId: sanction.id }"
          ><template #default="{ data }"
            ><p>
              {{
                (data as { motivo?: string }).motivo || 'El servidor no aportó un motivo detallado.'
              }}
            </p></template
          ></ContractSection
        >
        <p v-if="confirmedAppeal(sanction.id)" role="status">Apelación {{ confirmedAppeal(sanction.id)?.id }} confirmada · PENDIENTE</p>
        <button v-if="canAppeal(sanction)" :disabled="appealBlocked(sanction.id)" @click="openAppeal(sanction)">Apelar sanción</button>
        <button v-if="appealDraft(sanction.id) && appealBlocked(sanction.id) && !confirmedAppeal(sanction.id)" @click="openAppeal(sanction)">Ver motivo del envío pendiente</button>
      </article>
      <p v-if="sanctions.data.value?.length === 0">No tienes sanciones en tu historial.</p>
    </RemoteState>
  </section>
  <ContractSection
    title="Estado de mis apelaciones"
    contract="F04"
    :query="{ userId: session.user.id }"
    ><template #default="{ data }"
      ><p
        v-for="appeal in (data as { items: { id: string; status: string; reason: string }[] })
          .items"
        :key="appeal.id"
      >
        {{ appeal.reason }} · {{ appeal.status }}
      </p>
      <p v-if="!(data as { items: unknown[] }).items.length">
        No hay apelaciones en la respuesta recibida.
      </p></template
    ></ContractSection
  >
  <ModalDialog v-if="appealing" title="Apelar sanción" :busy="sending" @close="appealing = null">
    <form class="stack" @submit.prevent="sendAppeal">
      <p v-if="appealBlocked(appealing.id) && !confirmedAppeal(appealing.id)" class="error" role="status">Resultado pendiente de verificar. Conservamos el motivo en memoria; no se reenviará. Consulta su estado con personal.</p>
      <label
        >Motivo de la apelación<textarea
          v-model="reason"
          required
          maxlength="2000"
          rows="5"
          :disabled="sending"
          :readonly="appealBlocked(appealing.id)"
        />
      </label>
      <p v-if="appealError" class="error" role="alert">{{ appealError }}</p>
      <div class="row">
        <button type="button" :disabled="sending" @click="appealing = null">Cancelar</button
        ><button type="submit" :disabled="sending || !reason.trim() || appealBlocked(appealing.id)">
          {{ sending ? 'Enviando…' : 'Enviar apelación' }}
        </button>
      </div>
    </form>
  </ModalDialog>
</template>
<style scoped>
.student-welcome { margin-bottom: 28px; }
.greeting { font-size: 14px; margin-bottom: 4px; }
.student-welcome h1 { margin-bottom: 10px; line-height: 1.2; }
.student-status { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: start; font-size: 14px; }
.student-status > div { min-width: 0; max-width: 100%; }
.student-status > div:first-child { order: 3; }
.student-status details[open] { max-width: 440px; }
.student-status summary { cursor: pointer; }
.student-status .badge { white-space: normal; }
.student-section-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 16px; }
.student-section-heading h2 { margin: 0; }
.student-section-heading > span, .student-section-heading > a { font-size: 14px; }
.student-catalog, .student-loans { margin-bottom: 28px; }
.category-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.category-grid .category-card { padding: 20px; border-radius: 12px; min-width: 0; overflow-wrap: anywhere; }
.category-card h3 { font-weight: 700; margin-bottom: 12px; }
.availability-count { border-top: 1px solid #ffffffb3; padding-top: 12px; color: #047857; font-size: 14px; font-weight: 600; }
.category-resources { font-size: 12px; margin-top: 4px; }
.student-loan-table { background: white; border: 1px solid #dbe2ea; border-radius: 12px; }
.student-loan-table table { font-size: 14px; }
.student-loan-table caption { text-align: left; padding: 8px 20px; font-size: 12px; color: #526174; }
.student-loan-table th { padding: 12px 20px; }
.student-loan-table td { padding: 16px 20px; }
.loan-start { font-size: 12px; margin-top: 4px; }
.active-sanction { border-left: 4px solid #b91c1c; }
@media (max-width: 1023px) {
  .student-welcome { margin-bottom: 20px; }
  .student-section-heading { gap: 8px; margin-bottom: 10px; }
  .student-section-heading h2 { font-size: 16px; }
  .student-section-heading > span, .student-section-heading > a { font-size: 12px; }
  .category-grid { gap: 8px; }
  .category-grid .category-card { padding: 12px; background: white; }
  .category-card h3 { font-size: 14px; margin-bottom: 8px; }
  .availability-count { font-size: 12px; padding-top: 8px; border-top-color: #dbe2ea; }
  .availability-count .mobile-only { display: inline; }
  .student-catalog, .student-loans { margin-bottom: 20px; }
  .student-loan-card { padding: 12px; font-size: 14px; }
  .student-loan-card > * + * { margin-top: 6px; }
}
@media (max-width: 240px) { .category-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
