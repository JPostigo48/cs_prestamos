<script setup lang="ts">
import { getHistory, getSanctions } from '../api/student-api'
import { useRemote } from '../../../shared/composables/useRemote'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import RemoteState from '../../../shared/components/RemoteState.vue'
import SanctionDetails from '../../trust/components/SanctionDetails.vue'
import { dateTime } from '../../../shared/format'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import { useCopyDetails } from '../../inventory/useCopyDetails'
const props = defineProps<{ userId: string; name: string }>()
defineEmits<{ close: [] }>()
const loans = useRemote((signal) => getHistory(props.userId, signal))
const sanctions = useRemote((signal) => getSanctions(props.userId, signal))
const copyDetails = useCopyDetails(() => loans.data.value ?? [])
</script>
<template>
  <ModalDialog title="Historial de Usuario" :subtitle="name" @close="$emit('close')"
    ><div class="user-history">
    <details class="muted"><summary>Referencia del usuario</summary>{{ userId }}</details>
    <section class="stack history-section">
      <h3>Préstamos registrados</h3>
      <RemoteState :loading="loans.loading.value" :error="loans.error.value" @retry="loans.refresh"
        ><article v-for="loan in loans.data.value" :key="loan.id" class="history-entry" :class="{ overdue: loan.status === 'ACTIVO' && Date.parse(loan.endsAt) < Date.now() }">
          <div class="entry-heading"><h4>{{ copyDetails[loan.copyId]?.recurso.nombre || 'Ejemplar ' + loan.copyId }}</h4><StatusBadge :tone="loan.status === 'ACTIVO' && Date.parse(loan.endsAt) < Date.now() ? 'danger' : loan.return ? 'neutral' : 'info'">{{ loan.status }}</StatusBadge></div>
          <p v-if="copyDetails[loan.copyId]" class="muted">{{ copyDetails[loan.copyId]?.codigoInventario }}</p>
          <p>{{ dateTime(loan.startsAt) }} → {{ dateTime(loan.endsAt) }}</p>
          <p v-if="loan.return">Devuelto {{ dateTime(loan.return.returnedAt) }}</p>
        </article>
        <p v-if="loans.data.value?.length === 0">Sin préstamos registrados.</p></RemoteState
      >
    </section>
    <section class="stack history-section">
      <h3>Sanciones recibidas</h3>
      <RemoteState
        :loading="sanctions.loading.value"
        :error="sanctions.error.value"
        @retry="sanctions.refresh"
        ><article v-for="sanction in sanctions.data.value" :key="sanction.id" class="history-entry sanction-entry">
          <StatusBadge :tone="sanction.status === 'ACTIVA' ? 'danger' : 'neutral'">{{ sanction.status }}</StatusBadge>
          <p>
            {{ dateTime(sanction.startsAt) }} →
            {{ sanction.endsAt ? dateTime(sanction.endsAt) : 'Fin indefinido' }}
          </p>
          <p>Confianza: {{ sanction.previousTrust }} % → {{ sanction.resultingTrust }} %</p>
          <SanctionDetails :sanction-id="sanction.id" />
        </article>
        <p v-if="sanctions.data.value?.length === 0">Sin sanciones registradas.</p></RemoteState
      >
    </section>
    <button type="button" @click="$emit('close')">Cerrar historial</button>
    </div>
  </ModalDialog>
</template>
<style scoped>
.user-history details { font-size: 11px; }
.history-section { margin: 24px 0; }
.history-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; font-weight: 800; }
.history-entry { border-left: 4px solid #60a5fa; padding: 12px; border-radius: 0 8px 8px 0; background: #f8fafc; }
.history-entry.overdue { border-color: #ef4444; }
.history-entry.sanction-entry { border-color: #ef4444; background: #fef2f2; }
.entry-heading { display: flex; align-items: start; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.entry-heading h4 { font-size: 14px; font-weight: 700; }
.history-entry p { margin-top: 6px; font-size: 12px; }
.user-history > button { width: 100%; background: #f1f5f9; font-weight: 700; }
</style>
