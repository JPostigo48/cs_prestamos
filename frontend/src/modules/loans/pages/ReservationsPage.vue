<script setup lang="ts">
import MyTermsPanel from '../../auth/components/MyTermsPanel.vue'
</script>
<template>
  <header class="reservations-heading"><h1>Mis términos</h1><p class="muted">Consulta las condiciones de préstamo y las versiones que has aceptado.</p></header>
  <MyTermsPanel />
</template>
<style scoped>
.reservations-heading { margin-bottom: 24px; }
.reservations-heading p { font-size: 14px; margin-top: 8px; }
</style>
