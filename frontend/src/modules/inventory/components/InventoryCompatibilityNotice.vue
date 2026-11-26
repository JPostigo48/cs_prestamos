<script setup lang="ts">
import { inventoryCompatibilityMessage, type InventoryCompatibility } from '../api/compatibility-contracts'
defineProps<{ compatibility: InventoryCompatibility | null | undefined }>()
</script>
<template>
  <p v-if="inventoryCompatibilityMessage(compatibility)" class="panel inventory-compatibility-notice" role="status">{{ inventoryCompatibilityMessage(compatibility) }}</p>
</template>
