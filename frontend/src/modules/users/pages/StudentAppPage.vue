<script setup lang="ts">
import { computed, ref } from 'vue'
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
import { categoryAvailability, getGlobalAvailability, getCategories } from '../../inventory/api/inventory-api'
import { useCopyDetails } from '../../inventory/useCopyDetails'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import { canAppeal } from '../appeal-policy'
import ContractSection from '../../../shared/components/ContractSection.vue'
import { dateTime } from '../../../shared/format'
import { Star, ShieldCheck, TriangleAlert, ArrowRight } from '@lucide/vue'
import CategoryIcon from '../../inventory/components/CategoryIcon.vue'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
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
const copies = useCopyDetails(loans.data)
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
        ><details class="profile-details"><summary>Mi perfil</summary><dl v-if="profile.data.value" class="profile-grid">
          <div><dt>Nombre</dt><dd>{{ profile.data.value.name }}</dd></div>
          <div><dt>Correo de acceso</dt><dd>{{ session.user.email }}</dd></div>
          <div><dt>Tipo de usuario</dt><dd>{{ profile.data.value.userType }}</dd></div>
          <div><dt>Identificación institucional</dt><dd>{{ profile.data.value.institutionalId || 'No registrada' }}</dd></div>
          <div><dt>Vinculación institucional</dt><dd>{{ profile.data.value.hasCurrentAffiliation ? 'Vigente' : 'No vigente' }}</dd></div>
        </dl></details></RemoteState
      >
      </div>
      <div aria-label="Habilitación para préstamos">
      <RemoteState
        :loading="eligibility.loading.value"
        :error="eligibility.error.value"
        @retry="eligibility.refresh"
      >
        <details><summary><StatusBadge :tone="eligibility.data.value?.enabled ? 'success' : 'danger'"><ShieldCheck v-if="eligibility.data.value?.enabled" :size="13" aria-hidden="true" /><TriangleAlert v-else :size="13" aria-hidden="true" />
          {{
            eligibility.data.value?.enabled
              ? 'Préstamos habilitados'
              : 'Préstamos no habilitados'
          }}
        </StatusBadge></summary>
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
        ><details v-if="trust.data.value"><summary><StatusBadge :tone="trust.data.value.percentage >= 80 ? 'info' : trust.data.value.percentage >= 50 ? 'warning' : 'danger'"><Star :size="13" aria-hidden="true" />
          Confianza: {{ trust.data.value.percentage }} %
        </StatusBadge></summary><p>{{ trust.data.value.level.replaceAll('_', ' ') }}</p></details></RemoteState
      >
      </div>
    </div>
  </section>
  <p v-if="notice" class="notice" role="status">{{ notice }}</p>
  <section v-for="sanction in sanctions.data.value?.filter(item => item.status === 'ACTIVA')" :key="sanction.id" class="panel active-sanction" aria-label="Sanción activa">
    <h2><TriangleAlert :size="20" aria-hidden="true" /> Sanción activa</h2>
    <p>Vigente desde {{ date(sanction.startsAt) }} hasta {{ sanction.endsAt ? date(sanction.endsAt) : 'sin fecha registrada' }}.</p>
    <p v-if="confirmedAppeal(sanction.id)" role="status">Apelación {{ confirmedAppeal(sanction.id)?.id }} · PENDIENTE</p>
    <button v-if="canAppeal(sanction)" :disabled="appealBlocked(sanction.id)" @click="openAppeal(sanction)">Apelar sanción</button>
    <p>Los detalles y las apelaciones están disponibles en el historial de sanciones.</p>
  </section>
  <section class="student-catalog">
    <div class="student-section-heading"><h2>Explorar catálogo</h2><RouterLink to="/app/catalog">Ver todo <ArrowRight :size="14" aria-hidden="true" /></RouterLink></div>
    <RemoteState
      :loading="categories.loading.value"
      :error="categories.error.value"
      @retry="categories.refresh"
    >
      <ul class="category-grid">
        <li v-for="category in categories.data.value" :key="category.id" class="category-card">
          <CategoryIcon :name="category.nombre" />
          <h3>
            <RouterLink :to="{ path: '/app/catalog', query: { categoryId: category.id } }">{{
              category.nombre
            }}</RouterLink>
          </h3>
          <p class="availability-count" :aria-label="`${categoryAvailability(availability.error.value ? null : availability.data.value, category.id) ?? 'Desconocido'} ejemplares disponibles`">{{ categoryAvailability(availability.error.value ? null : availability.data.value, category.id) ?? 'Desconocido' }} <span class="desktop-only">ejemplares disponibles</span><span class="mobile-only" aria-hidden="true">disp.</span></p>
          <p class="muted category-resources desktop-only">{{ category.resourceCount }} recursos registrados</p>
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
          <thead><tr><th scope="col">Recurso y ejemplar</th><th scope="col">Categoría</th><th scope="col">Vencimiento / inicio</th><th scope="col">Estado</th></tr></thead>
          <tbody><tr v-for="loan in currentLoans" :key="loan.id">
            <td><RouterLink v-if="copies[loan.copyId]" :to="'/app/catalog/' + copies[loan.copyId]!.recurso.id">{{ copies[loan.copyId]!.recurso.nombre }}</RouterLink><span v-else>{{ loan.copyId }}</span><p class="muted">{{ copies[loan.copyId]?.codigoInventario || loan.copyId }}</p></td>
            <td class="muted">{{ categories.data.value?.find(c => c.id === copies[loan.copyId]?.recurso.categoriaId)?.nombre || 'No disponible' }}</td>
            <td><p>Hasta {{ date(loan.endsAt) }}</p><p class="muted loan-start">Inicio: {{ date(loan.startsAt) }}</p></td>
            <td><StatusBadge :tone="loan.status === 'ACTIVO' && new Date(loan.endsAt).getTime() < Date.now() ? 'danger' : 'info'">{{ loan.status === 'ACTIVO' && new Date(loan.endsAt).getTime() < Date.now() ? 'En mora' : loan.status }}</StatusBadge></td>
          </tr></tbody>
        </table>
      </div>
      <article v-for="loan in currentLoans" :key="loan.id" class="panel mobile-only student-loan-card">
        <div class="loan-card-heading">
        <div>
        <h3>
          <RouterLink
            v-if="copies[loan.copyId]"
            :to="'/app/catalog/' + copies[loan.copyId]!.recurso.id"
            >{{ copies[loan.copyId]!.recurso.nombre }}</RouterLink
          ><span v-else>Ejemplar {{ loan.copyId }}</span>
        </h3>
        <p class="muted loan-copy">{{ copies[loan.copyId]?.codigoInventario || loan.copyId }}</p>
        </div>
        <StatusBadge :tone="loan.status === 'ACTIVO' && new Date(loan.endsAt).getTime() < Date.now() ? 'danger' : 'info'">{{ loan.status === 'ACTIVO' && new Date(loan.endsAt).getTime() < Date.now() ? 'En mora' : loan.status }}</StatusBadge>
        </div>
        <p class="loan-deadline">Hasta {{ date(loan.endsAt) }}</p>
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
  <section class="panel sanction-history">
    <h2>Historial de sanciones</h2>
    <RemoteState
      :loading="sanctions.loading.value"
      :error="sanctions.error.value"
      @retry="sanctions.refresh"
    >
      <article v-for="sanction in sanctions.data.value" :key="sanction.id" class="panel stack">
        <h3>Sanción <StatusBadge :tone="sanction.status === 'ACTIVA' ? 'danger' : sanction.status === 'PROGRAMADA' ? 'warning' : 'neutral'">{{ sanction.status }}</StatusBadge></h3>
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
  <ModalDialog v-if="appealing" title="Apelar sanción" :busy="sending" compact @close="appealing = null">
    <form class="stack appeal-form" @submit.prevent="sendAppeal">
      <div class="appeal-context"><strong>Detalle de la sanción</strong><p>Desde {{ date(appealing.startsAt) }} hasta {{ appealing.endsAt ? date(appealing.endsAt) : 'sin fecha registrada' }}.</p><p>Confianza: {{ appealing.previousTrust }} % → {{ appealing.resultingTrust }} %</p></div>
      <p>Explica por qué solicitas una revisión. El envío no anula la sanción; recibirás la decisión de administración.</p>
      <p v-if="appealBlocked(appealing.id) && !confirmedAppeal(appealing.id)" class="error" role="status">Resultado pendiente de verificar. Conservamos el motivo en memoria; no se reenviará. Consulta su estado con personal.</p>
      <label
        >Motivo de la apelación<textarea
          v-model="reason"
          required
          maxlength="2000"
          placeholder="Explica tu solicitud de revisión…"
          rows="5"
          :disabled="sending"
          :readonly="appealBlocked(appealing.id)"
        />
      </label>
      <p v-if="appealError" class="error" role="alert">{{ appealError }}</p>
      <div class="row">
        <button type="button" :disabled="sending" @click="appealing = null">Cancelar</button
        ><button class="primary" type="submit" :disabled="sending || !reason.trim() || appealBlocked(appealing.id)">
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
.student-status > div:first-child { order: 3; flex-basis: 100%; margin-top: 4px; }
.student-status details[open] { max-width: 440px; }
.student-status .profile-details[open] { max-width: 100%; }
.profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 16px; margin-top: 12px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; }
.profile-grid dt { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
.profile-grid dd { color: #0f172a; overflow-wrap: anywhere; }
.sanction-history > :deep(article) { margin-top: 16px; background: #f8fafc; }
.appeal-context { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 8px; padding: 16px; font-size: 13px; line-height: 1.7; }
.appeal-form .row > button { flex: 1; font-size: 14px; font-weight: 600; }
.appeal-form > label { font-size: 13px; color: #475569; }
.student-status summary { cursor: pointer; }
.student-status > div:not(:first-child) summary { list-style: none; }
.student-status > div:not(:first-child) summary::-webkit-details-marker { display: none; }
.student-status .badge { white-space: normal; }
.student-section-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 16px; }
.student-section-heading h2 { margin: 0; }
.student-section-heading > span, .student-section-heading > a { font-size: 14px; }
.student-section-heading > a { display: inline-flex; gap: 6px; align-items: center; color: #2563eb; text-decoration: none; font-weight: 500; }
.student-catalog, .student-loans { margin-bottom: 28px; }
.category-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.student-catalog .category-grid .category-card { padding: 20px; border-radius: 12px; min-width: 0; overflow-wrap: anywhere; position: relative; border: 1px solid transparent; background: #edf4ff; transition: box-shadow .15s; }
.student-catalog .category-grid .category-card:nth-child(3n + 2) { background: #fbf4ff; border-color: transparent; }
.student-catalog .category-grid .category-card:nth-child(3n) { background: #effbf3; border-color: transparent; }
.category-card > svg { color: #2563eb; margin-bottom: 8px; }
.category-card:nth-child(3n + 2) > svg { color: #9333ea; }
.category-card:nth-child(3n) > svg { color: #059669; }
.category-card h3 { font-weight: 700; margin-bottom: 12px; font-size: 16px; }
.category-card a { color: #1e293b; text-decoration: none; }
.category-card a::after { content: ''; position: absolute; inset: 0; border-radius: 12px; }
.category-card:hover, .category-card:focus-within { box-shadow: 0 0 0 2px #93c5fd; }
.availability-count { border-top: 1px solid #ffffffb3; padding-top: 12px; color: #047857; font-size: 14px; font-weight: 600; }
.category-resources { font-size: 12px; margin-top: 4px; }
.student-loan-table { background: white; border: 1px solid #dbe2ea; border-radius: 12px; }
.student-loan-table table { font-size: 14px; }
.student-loan-table caption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.student-loan-table th { padding: 12px 20px; }
.student-loan-table td { padding: 16px 20px; }
.loan-start { font-size: 12px; margin-top: 4px; }
.panel.active-sanction { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 24px; border-color: #fecaca; background: #fef2f2; color: #991b1b; font-size: 14px; line-height: 1.6; }
.active-sanction > :is(h2, p) { grid-column: 1; }
.active-sanction > button { grid-column: 2; grid-row: 1 / span 4; align-self: center; }
.active-sanction h2 { display: flex; gap: 8px; align-items: center; font-size: 16px; }
.active-sanction button { background: #dc2626; color: white; border-color: #dc2626; margin: 12px 0; }
.active-sanction > p:last-child { font-size: 12px; }
.student-loan-card h3 a { color: #0f172a; text-decoration: none; font-weight: 600; }
.loan-card-heading { display: flex; justify-content: space-between; align-items: start; gap: 8px; }
.loan-card-heading > div { min-width: 0; }
.loan-card-heading > :deep(.status-badge) { flex-shrink: 0; }
.loan-copy { font-size: 12px; margin-top: 4px; }
.loan-deadline { border-top: 1px solid #f1f5f9; padding-top: 12px; font-size: 12px; }
.student-loan-table td:first-child a { text-decoration: none; color: #0f172a; font-weight: 600; }
@media (max-width: 1023px) {
  .student-welcome { margin-bottom: 20px; }
  .student-section-heading { gap: 8px; margin-bottom: 10px; }
  .student-section-heading h2 { font-size: 16px; }
  .student-section-heading > span, .student-section-heading > a { font-size: 12px; }
  .category-grid { gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .student-catalog .category-grid .category-card { padding: 12px; }
  .category-card h3 { font-size: 12px; margin-bottom: 8px; }
  .availability-count { font-size: 12px; padding-top: 8px; border-top-color: #dbe2ea; }
  .availability-count .mobile-only { display: inline; }
  .student-catalog, .student-loans { margin-bottom: 20px; }
  .student-loan-card { padding: 12px; font-size: 14px; }
  .student-loan-card > * + * { margin-top: 6px; }
  .active-sanction button { width: 100%; font-weight: 700; }
  .panel.active-sanction { display: block; }
}
@media (max-width: 359px) { .category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
