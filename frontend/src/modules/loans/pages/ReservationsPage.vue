<script setup lang="ts">
import ReservationsPanel from '../components/ReservationsPanel.vue'
import TermsPanel from '../../auth/components/TermsPanel.vue'
</script>
<template>
  <header class="reservations-heading"><h1>Mis reservas y términos</h1><p class="muted">Revisa tus solicitudes, organiza la recogida y consulta las condiciones de préstamo.</p></header>
  <ReservationsPanel />
  <section class="panel"><TermsPanel allow-acceptance /></section>
</template>
<style scoped>
.reservations-heading { margin-bottom: 24px; }
.reservations-heading p { font-size: 14px; margin-top: 8px; }
</style>
