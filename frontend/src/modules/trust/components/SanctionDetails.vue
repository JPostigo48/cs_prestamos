<script setup lang="ts">
import { getSanction } from '../api/trust-api'
import { useRemote } from '../../../shared/composables/useRemote'
import RemoteState from '../../../shared/components/RemoteState.vue'
import { dateTime } from '../../../shared/format'
const props = defineProps<{ sanctionId: string }>()
const remote = useRemote(signal => getSanction(props.sanctionId, signal), () => props.sanctionId, false)
</script>
<template>
  <section class="panel stack">
    <h2>Motivo y detalles de la sanción</h2>
    <button :disabled="remote.loading.value" @click="remote.refresh">Consultar / actualizar</button>
    <RemoteState :loading="remote.loading.value" :error="remote.error.value" @retry="remote.refresh">
      <template v-if="remote.data.value">
        <p>{{ remote.data.value.reason ?? 'El servidor no aportó un motivo detallado.' }}</p>
        <p>Estado: {{ remote.data.value.status }} · {{ dateTime(remote.data.value.startsAt) }} — {{ remote.data.value.endsAt ? dateTime(remote.data.value.endsAt) : 'Sin fecha de fin' }}</p>
        <p>Confianza: {{ remote.data.value.previousTrust }} % → {{ remote.data.value.resultingTrust }} %</p>
        <div v-if="remote.data.value.rule">
          <h3>{{ remote.data.value.rule.title }} · versión {{ remote.data.value.rule.number }}</h3>
          <p>{{ remote.data.value.rule.consequence }}</p>
          <p>Suspensión: {{ remote.data.value.rule.suspensionType ?? 'No registrada' }}<span v-if="remote.data.value.rule.suspensionDays !== null"> · {{ remote.data.value.rule.suspensionDays }} días</span></p>
        </div>
        <p v-else>Versión histórica de la regla no disponible. No se reconstruye con la regla actual.</p>
        <p v-if="remote.data.value.violation">Incumplimiento: {{ remote.data.value.violation.id }} · {{ dateTime(remote.data.value.violation.occurredAt) }} · Penalización aplicada: {{ remote.data.value.violation.appliedPenalty }}</p>
        <p v-else>Sin incumplimiento detallado disponible.</p>
        <h3>Apelaciones vinculadas</h3>
        <p v-for="appeal in remote.data.value.appeals" :key="appeal.id">{{ appeal.reason }} · {{ appeal.status }}<span v-if="appeal.resolution"> · {{ appeal.resolution }}</span></p>
        <p v-if="!remote.data.value.appeals.length">Sin apelaciones vinculadas.</p>
        <h3>Historial</h3>
        <ul><li v-for="(entry, index) in remote.data.value.history" :key="index">{{ entry.action }} · {{ dateTime(entry.occurredAt) }} · {{ entry.actorAccountId ?? 'Sistema / actor no registrado' }}<span v-if="entry.reason"> · {{ entry.reason }}</span></li></ul>
        <p v-if="!remote.data.value.history.length">Sin eventos disponibles.</p>
      </template>
    </RemoteState>
  </section>
</template>
