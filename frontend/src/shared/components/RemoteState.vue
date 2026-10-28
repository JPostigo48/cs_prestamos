<script setup lang="ts">
defineProps<{ loading: boolean; error: string }>()
defineEmits<{ retry: [] }>()
</script>
<template>
  <p v-if="loading" role="status">Cargando…</p>
  <div v-else-if="error" role="alert" class="error">
    <p>{{ error }}</p>
    <button type="button" @click="$emit('retry')">Volver a intentar</button>
  </div>
  <slot v-else />
</template>
