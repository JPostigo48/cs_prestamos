<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getSession } from '../../auth/api/auth-api'
import { getReservationSettings, saveReservationSettings } from '../api/reservation-settings-api'
import { dayNames, scheduleError, waitError, type ReservationSettings, type ScheduleDay } from '../reservation-time'
import { errorMessage, useRemote } from '../../../shared/composables/useRemote'
import { ApiError } from '../../../shared/api/client'
import AlertHint from '../../../shared/components/AlertHint.vue'

const allowed = getSession()?.user.role === 'ADMINISTRADOR'
const remote = useRemote(getReservationSettings, () => true, allowed)
const wait = ref<number>(0), configured = ref(false), days = ref<ScheduleDay[]>([])
const saving = ref(false), error = ref(''), success = ref(''), uncertain = ref(false)
function apply(settings: ReservationSettings) {
  wait.value = settings.pickupWaitMinutes
  configured.value = settings.weeklySchedule !== null
  days.value = settings.weeklySchedule?.map(d => ({ day: d.day, intervals: d.intervals.map(i => ({ ...i })) }))
    ?? dayNames.map((_, index) => ({ day: index + 1, intervals: [] }))
  days.value.sort((a, b) => a.day - b.day)
}
watch(remote.data, value => { if (value) { apply(value); uncertain.value = false } })
const validation = computed(() => waitError(wait.value) || scheduleError(configured.value ? days.value : null))
const dirty = computed(() => !!remote.data.value && (wait.value !== remote.data.value.pickupWaitMinutes ||
  JSON.stringify(configured.value ? days.value : null) !== JSON.stringify(remote.data.value.weeklySchedule)))
async function reload() {
  if (saving.value) return
  error.value = ''; success.value = ''
  await remote.refresh()
}
async function save() {
  if (!allowed || saving.value || remote.loading.value || !remote.data.value || validation.value || uncertain.value || !dirty.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    const saved = await saveReservationSettings({ pickupWaitMinutes: wait.value, weeklySchedule: configured.value ? days.value : null })
    remote.data.value = saved
    apply(saved)
    success.value = 'Configuración guardada.'
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.status === 503
      ? 'Configuración no disponible. Verifica con administración la migración pendiente antes de reintentar.' : errorMessage(cause)
    uncertain.value = !(cause instanceof ApiError) || cause.status === 0 || cause.status >= 500
  } finally { saving.value = false }
}
</script>
<template>
  <section v-if="allowed" class="system-settings stack">
    <header><h1>Configuración del sistema</h1><p>Horario de atención y espera de recogida.</p></header>
    <p>America/Lima · Los cambios afectan solo a nuevas reservas.</p>
    <p v-if="remote.loading.value" role="status">Cargando configuración…</p>
    <div v-else-if="remote.error.value" class="panel" role="alert"><AlertHint :message="remote.error.value" label="Error de configuración" /> Configuración no disponible.<p v-if="remote.status.value === 503">Verifica con administración la migración pendiente.</p><button type="button" @click="reload">Reintentar</button></div>
    <form v-else-if="remote.data.value" class="stack" @submit.prevent="save">
      <section class="panel stack">
        <label>Espera de recogida (minutos)<input v-model.number="wait" type="number" min="1" max="240" step="1" required :disabled="saving || uncertain" /></label>
        <p v-if="remote.data.value.scheduleStatus === 'UNCONFIGURED'">Horario sin configurar</p>
        <label class="schedule-toggle"><input v-model="configured" type="checkbox" :disabled="saving || uncertain" /> Definir horario semanal</label>
        <p v-if="!configured">No se comprueba disponibilidad por horario. Esto no garantiza atención permanente.</p>
        <p v-if="configured && remote.data.value.scheduleStatus === 'UNCONFIGURED'">Borrador sin guardar: los días sin franjas quedan cerrados.</p>
      </section>
      <div v-if="configured" class="week-grid">
        <fieldset v-for="day in days" :key="day.day" class="panel stack" :disabled="saving || uncertain">
          <legend>{{ dayNames[day.day - 1] }}</legend>
          <p v-if="!day.intervals.length">Cerrado</p>
          <div v-for="(interval, index) in day.intervals" :key="index" class="interval">
            <label>Apertura<input v-model="interval.opens" type="time" required :aria-label="`${dayNames[day.day - 1]} apertura ${index + 1}`" /></label>
            <label>Cierre<input v-model="interval.closes" type="time" required :aria-label="`${dayNames[day.day - 1]} cierre ${index + 1}`" /></label>
            <button type="button" :aria-label="`Quitar franja ${index + 1} de ${dayNames[day.day - 1]}`" @click="day.intervals.splice(index, 1)">Quitar</button>
          </div>
          <button type="button" :disabled="day.intervals.length >= 12" @click="day.intervals.push({ opens: '', closes: '' })">Añadir franja</button>
        </fieldset>
      </div>
      <p v-if="validation" role="status"><AlertHint :message="validation" /> {{ validation }}</p>
      <p v-if="dirty" class="draft">Cambios sin guardar</p>
      <p v-if="error" role="alert"><AlertHint :message="error" label="Error al guardar" /> {{ error }}</p>
      <p v-if="uncertain" role="status">Guardado sin confirmar. Consulta el estado antes de volver a guardar. <button type="button" @click="reload">Consultar configuración</button></p>
      <p v-if="success" role="status">{{ success }}</p>
      <div class="row"><button class="primary" :disabled="saving || uncertain || !!validation || !dirty">{{ saving ? 'Guardando…' : 'Guardar configuración' }}</button><button type="button" :disabled="saving" @click="reload">Volver a cargar</button></div>
    </form>
  </section>
  <p v-else role="alert">Acceso exclusivo de administración.</p>
</template>
<style scoped>
.system-settings { max-width: 1100px; margin: auto; }
.system-settings header p, .system-settings > p, .draft { color: #64748b; font-size: 13px; }
.week-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 16px; }
fieldset { min-width: 0; margin: 0; border: 1px solid #e2e8f0; }
legend { font-weight: 700; padding: 0 6px; }
.interval { display: flex; align-items: end; flex-wrap: wrap; gap: 8px; }
.interval label { flex: 1; min-width: 100px; }
.interval button { font-size: 12px; }
.schedule-toggle { display: flex; align-items: center; gap: 8px; }
.schedule-toggle input { width: auto; }
</style>
