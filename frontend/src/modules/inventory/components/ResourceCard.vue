<script setup lang="ts">
import { Clock } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { resourceDestination } from '../catalog-query'
import { durationLabel, type Category, type Resource } from '../api/inventory-api'
defineProps<{ resource: Resource; category?: Category; management?: boolean }>()
const route = useRoute()
</script>
<template>
  <article class="panel resource-card">
    <div class="stack">
      <span class="badge">{{ category?.nombre || 'Categoría no disponible' }}</span>
      <h2>
        <RouterLink :to="resourceDestination(resource.id, route.query, management)">{{ resource.nombre }}</RouterLink>
      </h2>
      <p class="muted description">{{ resource.descripcion || 'Sin descripción registrada.' }}</p>
      <p>
        <strong>{{ resource.availableCopies }}</strong> disponibles
      </p>
      <p v-if="category" class="row muted"><Clock :size="16" /> {{ durationLabel(category) }}</p>
      <slot />
    </div>
  </article>
</template>
<style scoped>
.resource-card {
  padding: 0 !important;
  overflow: hidden;
}
.resource-card > .stack {
  padding: 1.25rem;
}
.description {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
