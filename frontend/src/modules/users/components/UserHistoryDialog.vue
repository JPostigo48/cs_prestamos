<script setup lang="ts">
import { getHistory, getSanctions } from '../api/student-api'
import { useRemote } from '../../../shared/composables/useRemote'
import ModalDialog from '../../../shared/components/ModalDialog.vue'
import RemoteState from '../../../shared/components/RemoteState.vue'
import ContractSection from '../../../shared/components/ContractSection.vue'
import { dateTime } from '../../../shared/format'
const props = defineProps<{ userId: string; name: string }>()
defineEmits<{ close: [] }>()
const loans = useRemote((signal) => getHistory(props.userId, signal))
const sanctions = useRemote((signal) => getSanctions(props.userId, signal))
</script>
<template>
  <ModalDialog :title="'Historial de ' + name" @close="$emit('close')"
    ><p class="muted">
      Usuario {{ userId }} · No incluye auditoría ni movimientos de confianza no expuestos.
    </p>
    <section class="stack">
      <h3>Préstamos</h3>
      <RemoteState :loading="loans.loading.value" :error="loans.error.value" @retry="loans.refresh"
        ><article v-for="loan in loans.data.value" :key="loan.id" class="panel">
          <h4>{{ loan.status }} · Ejemplar {{ loan.copyId }}</h4>
          <p>{{ dateTime(loan.startsAt) }} → {{ dateTime(loan.endsAt) }}</p>
          <p v-if="loan.return">Devuelto {{ dateTime(loan.return.returnedAt) }}</p>
        </article>
        <p v-if="loans.data.value?.length === 0">Sin préstamos registrados.</p></RemoteState
      >
    </section>
    <section class="stack">
      <h3>Sanciones</h3>
      <RemoteState
        :loading="sanctions.loading.value"
        :error="sanctions.error.value"
        @retry="sanctions.refresh"
        ><article v-for="sanction in sanctions.data.value" :key="sanction.id" class="panel">
          <h4>{{ sanction.status }}</h4>
          <p>
            {{ dateTime(sanction.startsAt) }} →
            {{ sanction.endsAt ? dateTime(sanction.endsAt) : 'Fin indefinido' }}
          </p>
          <p>Confianza: {{ sanction.previousTrust }} % → {{ sanction.resultingTrust }} %</p>
          <ContractSection
            title="Detalle de la sanción"
            contract="F05"
            :params="{ sanctionId: sanction.id }"
            ><template #default="{ data }"
              ><p>{{ (data as { motivo?: string }).motivo || 'Motivo no disponible' }}</p></template
            ></ContractSection
          >
        </article>
        <p v-if="sanctions.data.value?.length === 0">Sin sanciones registradas.</p></RemoteState
      >
    </section>
    <button type="button" @click="$emit('close')">Cerrar historial</button>
  </ModalDialog>
</template>
