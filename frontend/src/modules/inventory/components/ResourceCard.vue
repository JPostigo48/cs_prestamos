<script setup lang="ts">
import { Clock } from '@lucide/vue'
import StatusBadge from '../../../shared/components/StatusBadge.vue'
import { useRoute } from 'vue-router'
import { resourceDestination } from '../catalog-query'
import { durationLabel, type Category, type Resource } from '../api/inventory-api'
defineProps<{ resource: Resource; category?: Category; management?: boolean; grouped?: boolean }>()
const route = useRoute()
</script>
<template>
  <article class="panel resource-card" :class="{ grouped, management }">
    <div class="card-content">
      <span class="mobile-stock" :class="{ unavailable: resource.availableCopies === 0 }">{{ resource.availableCopies ? resource.availableCopies + ' disponibles' : 'Sin disponibilidad' }}</span>
      <span v-if="management" class="management-stock" :class="{ unavailable: resource.availableCopies === 0 }">{{ resource.availableCopies }}<small> disponibles</small></span>
      <span class="category-label">{{ category?.nombre || 'Categoría no disponible' }}</span>
      <h2>
        <RouterLink :to="resourceDestination(resource.id, route.query, management)">{{ resource.nombre }}</RouterLink>
      </h2>
      <p class="muted description">{{ resource.descripcion || 'Sin descripción registrada.' }}</p>
      <footer>
        <StatusBadge :tone="resource.availableCopies > 0 ? 'success' : 'danger'">{{ resource.availableCopies }} disponibles</StatusBadge>
        <span v-if="category" class="duration"><Clock :size="14" aria-hidden="true" /> {{ durationLabel(category) }}</span>
        <span class="detail-hint" aria-hidden="true">Ver detalle →</span>
      </footer>
      <slot />
    </div>
  </article>
</template>
<style scoped>
.resource-card {
  padding: 0 !important;
  overflow: hidden;
  margin-bottom: 0;
  transition: border-color .15s, box-shadow .15s;
  position: relative;
}
.resource-card:hover { border-color: #93c5fd; box-shadow: 0 4px 12px #0f172a0a; }
.resource-card:focus-within { outline: 2px solid #60a5fa; outline-offset: 2px; }
.card-content { padding: 20px; height: 100%; display: flex; flex-direction: column; align-items: start; }
.category-label { background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.resource-card h2 { font-size: 18px; line-height: 1.3; margin: 16px 0 4px; }
.resource-card h2 a { color: #0f172a; text-decoration: none; }
.resource-card h2 a::after { content: ''; position: absolute; inset: 0; }
.resource-card :deep(button) { position: relative; z-index: 1; margin-top: 12px; }
footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; width: 100%; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 20px; }
.duration { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
.mobile-stock, .detail-hint { display: none; }
.management .card-content { padding: 16px; }
.management-stock { align-self: end; font-size: 14px; font-weight: 800; color: #059669; }
.management-stock span, .management-stock small { font-size: 11px; font-weight: 500; }
.management-stock.unavailable { color: #dc2626; }
.management .category-label { margin-top: -20px; max-width: 55%; }
.management h2 { font-size: 14px; margin-top: 12px; }
.management .description { font-size: 12px; }
.management footer { margin-top: 12px; padding-top: 10px; }
.management footer :deep(.status-badge) { display: none; }
.management :deep(button) { width: 100%; background: #eff6ff; color: #1d4ed8; border-color: #dbeafe; font-size: 12px; font-weight: 700; }
.description {
  font-size: 14px;
  line-height: 1.6;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@media (max-width: 600px) { .card-content { padding: 16px; } .resource-card h2 { font-size: 16px; } }
@media (max-width: 1023px) {
  .grouped .category-label, .grouped footer :deep(.status-badge) { display: none; }
  .grouped .mobile-stock { display: inline; font-size: 12px; font-weight: 600; color: #15803d; }
  .grouped .mobile-stock.unavailable { color: #b91c1c; }
  .grouped .detail-hint { display: inline; font-size: 12px; font-weight: 600; color: #2563eb; }
  .grouped h2 { margin-top: 12px; font-size: 14px; }
  .grouped .description { font-size: 12px; }
}
</style>
