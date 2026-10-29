<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }>(), { tone: 'info' })
</script>
<template><span class="status-badge" :class="tone"><slot /></span></template>
<style scoped>
.status-badge { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 4px 10px; border: 1px solid transparent; border-radius: 999px; font-size: 12px; line-height: 1.5; font-weight: 600; overflow-wrap: anywhere; }
.info { background: #eff6ff; color: #1d4ed8; border-color: #dbeafe; }
.success { background: #f0fdf4; color: #15803d; border-color: #dcfce7; }
.warning { background: #fff7ed; color: #9a3412; border-color: #fed7aa; }
.danger { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.neutral { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
</style>
