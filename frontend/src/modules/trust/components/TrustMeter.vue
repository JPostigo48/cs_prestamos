<script setup lang="ts">
import { computed, ref } from 'vue'
import { Info } from '@lucide/vue'
import { trustLevel } from '../trust-level'
import ModalDialog from '../../../shared/components/ModalDialog.vue'

const props = withDefaults(
  defineProps<{ percentage: number; level: string; currentlyPenalized?: boolean }>(),
  { currentlyPenalized: false },
)

const TICKS = [0, 25, 50, 75, 100]
const SEGMENTS = ['Crítico', 'En observación', 'Confiable', 'Excelente']

const explaining = ref(false)

const clamped = computed(() => {
  const value = Number(props.percentage)
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
})
const shown = computed(() => Math.round(clamped.value))
const info = computed(() => trustLevel(props.level))
const fillStyle = computed(() => ({
  width: clamped.value + '%',
  background: 'linear-gradient(90deg, ' + info.value.color + '99, ' + info.value.color + ')',
}))
</script>

<template>
  <div class="trust-meter">
    <div class="meter-head">
      <div class="meter-head-left">
        <span class="meter-title">Confianza</span>
        <span class="meter-level" :style="{ color: info.color }">{{ info.label }}</span>
      </div>
      <span class="meter-value">{{ shown }} %</span>
    </div>
    <div
      class="bar-wrap"
      role="meter"
      :aria-valuenow="clamped"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Nivel de confianza"
    >
      <div class="bar-track">
        <span class="bar-fill" :style="fillStyle" />
        <i v-for="tick in [25, 50, 75]" :key="tick" class="bar-tick" :style="{ left: tick + '%' }" />
        <span class="bar-marker" :style="{ left: clamped + '%', background: info.color }" />
      </div>
      <div class="bar-scale" aria-hidden="true">
        <span v-for="tick in TICKS" :key="tick">{{ tick }}</span>
      </div>
      <div class="bar-segments" aria-hidden="true">
        <span v-for="segment in SEGMENTS" :key="segment">{{ segment }}</span>
      </div>
    </div>
    <p v-if="currentlyPenalized" class="trust-penalty" role="status">
      Tienes una sanción vigente. Puede impedirte reservar o pedir préstamos aunque tu nivel de
      confianza lo permita.
    </p>
    <button type="button" class="trust-explain-btn" aria-haspopup="dialog" @click="explaining = true">
      <Info :size="14" aria-hidden="true" />
      ¿Cómo se calcula?
    </button>
    <ModalDialog v-if="explaining" title="¿Cómo se calcula mi confianza?" @close="explaining = false">
      <div class="explain-body">
        <section>
          <h3>Niveles</h3>
          <ul>
            <li>Excelente 75–100 %</li>
            <li>Confiable 50–74 %</li>
            <li>En observación 25–49 %</li>
            <li>Crítico 0–24 %</li>
          </ul>
        </section>
        <section>
          <h3>Cómo sube</h3>
          <p>Devolver a tiempo, completo y sin daños suma puntos (referencia actual: +3 en electrónicos, +1 en libros y deportes).</p>
        </section>
        <section>
          <h3>Cómo baja</h3>
          <ul>
            <li>Devolver tarde, dañar el recurso o dejar piezas faltantes.</li>
            <li>No recoger una reserva a tiempo (30 min de tolerancia).</li>
            <li>La pérdida o el robo lleva tu confianza a 0 %.</li>
          </ul>
        </section>
        <section>
          <h3>Qué puedes reservar</h3>
          <ul>
            <li>Electrónicos solo con nivel Excelente o Confiable.</li>
            <li>Libros y deportes también con En observación.</li>
            <li>Con Crítico no puedes reservar nada.</li>
          </ul>
        </section>
        <p class="muted trust-note">
          Los valores son de referencia y pueden cambiar con nuevas versiones de las reglas.
        </p>
      </div>
      <div class="explain-actions">
        <button class="primary" type="button" @click="explaining = false">Entendido</button>
      </div>
    </ModalDialog>
  </div>
</template>

<style scoped>
.trust-meter {
  width: 100%;
  max-width: 560px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.meter-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.meter-head-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}
.meter-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}
.meter-level {
  font-size: 12px;
  font-weight: 700;
}
.meter-value {
  font-size: 23px;
  font-weight: 800;
  line-height: 1;
  color: #0f172a;
  white-space: nowrap;
}
.bar-track {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: #e2e8f0;
}
.bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  transition: width 0.6s ease;
}
.bar-tick {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #94a3b8;
  transform: translateX(-1px);
}
.bar-marker {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 1px #cbd5e1;
  transform: translate(-50%, -50%);
  transition: left 0.6s ease;
}
@media (prefers-reduced-motion: reduce) {
  .bar-fill,
  .bar-marker {
    transition: none;
  }
}
.bar-scale {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 10px;
  color: #64748b;
}
.bar-segments {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  font-size: 10px;
  line-height: 1.3;
  color: #64748b;
  text-align: center;
  overflow-wrap: anywhere;
}
@media (max-width: 359px), (min-width: 900px) {
  .bar-segments {
    display: none;
  }
}
.trust-penalty {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: #991b1b;
  overflow-wrap: anywhere;
}
.trust-explain-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: start;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.trust-explain-btn:hover {
  text-decoration: underline;
}
.trust-explain-btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
  border-radius: 4px;
}
.explain-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 14px;
  line-height: 1.6;
  color: #334155;
}
.explain-body h3 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}
.explain-body ul {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding-left: 18px;
}
.explain-body p {
  margin: 0;
}
.explain-body li {
  overflow-wrap: anywhere;
}
.trust-note {
  font-size: 12px;
}
.explain-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
@media (max-width: 479px) {
  .meter-value {
    font-size: 22px;
  }
  .bar-segments {
    font-size: 9px;
    gap: 2px;
  }
}
</style>
