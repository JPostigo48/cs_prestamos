<script setup lang="ts">
import { computed } from 'vue'
import { ShieldAlert, TrendingDown, CalendarClock } from '@lucide/vue'
import { getSanction } from '../api/trust-api'
import { sanctionReason } from '../sanction-presentation'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import { dateTime } from '../../../shared/format'
const props = defineProps<{ sanctionId: string; revision?: number }>()
const remote = useRemote(signal => getSanction(props.sanctionId, signal), () => [props.sanctionId, props.revision])
const detail = remote.data
const currentRule = computed(() => detail.value?.current?.rule ?? detail.value?.rule)
const reason = computed(() => detail.value ? sanctionReason(detail.value) : '')
const statuses = { ACTIVA: 'Activa', PROGRAMADA: 'Programada', FINALIZADA: 'Finalizada', ABSUELTA: 'Absuelta' }
const appealStatuses = { PENDIENTE: 'Pendiente de revisión', ACEPTADA: 'Aceptada', RECHAZADA: 'Rechazada' }
</script>
<template>
  <div class="sanction-details">
    <RemoteState :loading="remote.loading.value" :error="remote.error.value" @retry="remote.refresh">
      <template v-if="detail">
        <div class="sanction-heading"><h3><ShieldAlert :size="19" aria-hidden="true" />{{ reason }}</h3><StatusBadge :tone="detail.status === 'ACTIVA' ? 'danger' : detail.status === 'PROGRAMADA' ? 'warning' : 'neutral'">{{ statuses[detail.status] }}</StatusBadge></div>
        <div class="sanction-meta">
          <p><TrendingDown :size="16" aria-hidden="true" />Antecedente inicial · Confianza: {{ detail.previousTrust }} % → {{ detail.resultingTrust }} %<span v-if="detail.violation?.appliedPenalty"> · Penalización inicial: {{ detail.violation.appliedPenalty }} puntos</span></p>
          <p><CalendarClock :size="16" aria-hidden="true" /><time :datetime="detail.violation?.occurredAt || detail.startsAt">{{ dateTime(detail.violation?.occurredAt || detail.startsAt) }}</time></p>
        </div>
        <p v-if="detail.current && detail.rule">Regla inicial: {{ detail.rule.title }} · Versión {{ detail.rule.number }}<template v-if="detail.rule.suspensionDays"> · {{ detail.rule.suspensionDays }} días iniciales</template></p>
        <section v-if="detail.current" aria-label="Consecuencia actual acumulada">
          <h4>Consecuencia actual acumulada · {{ detail.current.severity }}</h4>
          <p>{{ detail.current.rule.title }} · Versión {{ detail.current.rule.number }}</p>
          <p>Objetivo nominal: {{ detail.current.nominalPenaltyTotal === null ? 'saldo cero' : detail.current.nominalPenaltyTotal + ' puntos' }} · Descuento efectivo total: {{ detail.current.effectivePenaltyTotal }} puntos</p>
          <p v-if="detail.current.suspensionDays">Suspensión acumulada: {{ detail.current.suspensionDays }} días</p>
          <p v-if="detail.status === 'ABSUELTA'">Sanción absuelta; estos importes son históricos, no un cargo vigente.</p>
          <details><summary>Historial de ajustes ({{ detail.current.adjustments.length }})</summary>
            <ol><li v-for="a in detail.current.adjustments" :key="a.id">{{ a.severity }} · versión {{ a.ruleVersionId }} · efectivo {{ a.effectiveDiscount }} puntos · {{ a.previousTrust }} % → {{ a.resultingTrust }} % · <time :datetime="a.effectiveAt">{{ dateTime(a.effectiveAt) }}</time></li></ol>
          </details>
        </section>
        <p v-else-if="detail.current === null">Sin episodio de ajustes asociado: se muestra el antecedente inicial disponible.</p>
        <p v-else role="status">Historial de ajustes desconocido en esta respuesta antigua; el antecedente inicial no acredita la consecuencia acumulada actual.</p>
        <p v-if="currentRule?.suspensionType === 'TEMPORAL' || currentRule?.suspensionType === 'INDEFINIDA'" class="suspension">Suspensión {{ currentRule.suspensionType === 'INDEFINIDA' ? 'indefinida' : 'temporal' }}<template v-if="detail.endsAt"> · hasta <time :datetime="detail.endsAt">{{ dateTime(detail.endsAt) }}</time></template><template v-else-if="currentRule.suspensionDays"> · {{ currentRule.suspensionDays }} días</template>.</p>
        <details v-if="detail.appeals.length" class="appeal-details"><summary>Apelaciones de esta sanción ({{ detail.appeals.length }})</summary>
          <article v-for="appeal in detail.appeals" :key="appeal.id"><strong>{{ appealStatuses[appeal.status] }}</strong> · <time :datetime="appeal.submittedAt">{{ dateTime(appeal.submittedAt) }}</time><p>{{ appeal.reason }}</p><p v-if="appeal.resolution">Resolución: {{ appeal.resolution }}</p></article>
        </details>
      </template>
    </RemoteState>
  </div>
</template>
<style scoped>
.sanction-details { font-size: 13px; overflow-wrap: anywhere; }
.sanction-heading { display: flex; flex-wrap: wrap; align-items: start; justify-content: space-between; gap: 10px; }
.sanction-heading h3 { display: flex; gap: 8px; align-items: start; font-size: 15px; color: #1e3a5f; margin: 0; flex: 1; min-width: 180px; }
.sanction-heading svg, .sanction-meta svg { flex-shrink: 0; }
.sanction-meta { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 12px; color: #475569; }
.sanction-meta p { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin: 0; }
.suspension, .appeal-details { margin-top: 12px; }
summary { cursor: pointer; color: #1e40af; }
.appeal-details article { margin-top: 12px; padding-left: 12px; border-left: 2px solid #dbeafe; }
</style>
