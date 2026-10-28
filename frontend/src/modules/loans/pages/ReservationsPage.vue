<script setup lang="ts">
import ReservationsPanel from '../components/ReservationsPanel.vue'
import TermsPanel from '../../auth/components/TermsPanel.vue'
</script>
<template>
  <h1>Mis reservas y términos</h1>
  <ReservationsPanel />
  <section class="panel"><TermsPanel allow-acceptance /></section>
</template>
