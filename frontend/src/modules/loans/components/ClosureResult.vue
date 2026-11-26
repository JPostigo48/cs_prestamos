<script setup lang="ts">
import type { Loan } from '../api/loans-api'
import { onMounted, ref } from 'vue'
import { dateTime } from '../../../shared/format'
import ClosureHistoryNotice from './ClosureHistoryNotice.vue'
defineProps<{ loan: Loan }>()
const heading = ref<HTMLElement>()
onMounted(() => heading.value?.focus())
</script>
<template>
  <section class="panel stack" role="status" aria-label="Resultado persistido del cierre">
    <ClosureHistoryNotice :loan="loan" />
    <template v-if="loan.closure">
    <h3 ref="heading" tabindex="-1">{{ loan.closure?.reason === 'DEVOLUCION' ? 'Devolución real confirmada' : 'Cierre por ' + (loan.closure?.reason === 'ROBO' ? 'robo' : 'pérdida') }}</h3>
    <p>{{ dateTime(loan.closure?.effectiveAt ?? '') }}</p>
    <p>Ejemplar: {{ loan.copy?.estado }} · Condición física: {{ loan.copy?.condicionFisica ?? 'Sin clasificación' }} · {{ loan.copy?.habilitado ? 'Habilitado' : 'Deshabilitado' }}.</p>
    <p v-if="loan.copy?.estado !== 'DISPONIBLE'">Retenido: no puede prestarse sin revisión y disponibilidad confirmada.</p>
    <p v-else>Disponibilidad registrada al cerrar; debe comprobarse nuevamente con la actividad del recurso y la categoría antes de prestar.</p>
    <ul><li v-for="c in loan.consequences" :key="c.violationId">{{ c.kind }} · {{ c.severity }}: descuento efectivo acumulado {{ c.effectivePenaltyTotal }} puntos; suspensión {{ c.suspensionType }}<span v-if="c.suspensionDays !== null"> · {{ c.suspensionDays }} días</span>.</li></ul>
    <p v-if="loan.closureHistory === 'AVAILABLE' && loan.consequences?.length === 0">Sin consecuencias sancionadoras registradas.</p>
    <p v-if="loan.reward">Recompensa: {{ loan.reward.reason }} · {{ loan.reward.effectivePoints }} puntos efectivos (calculados: {{ loan.reward.calculatedPoints }}). Confianza: {{ loan.reward.previousTrust }} → {{ loan.reward.resultingTrust }}.</p>
    <p v-else-if="loan.closureHistory === 'AVAILABLE' && loan.reward === null">Sin recompensa.</p>
    <p v-if="loan.cancelledReservationIds">Reservas canceladas: {{ loan.cancelledReservationIds.length }}.</p>
    </template>
  </section>
</template>
