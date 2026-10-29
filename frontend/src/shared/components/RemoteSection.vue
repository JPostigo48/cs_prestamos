<script setup lang="ts">
import { ref } from 'vue'
import { useRemote } from '../composables/useRemote'
const props = defineProps<{
  title: string
  load: (signal: AbortSignal) => Promise<unknown>
  isEmpty?: (data: unknown) => boolean
}>()
const detail = ref('')
const development = import.meta.env.DEV
const { data, loading, error, refresh } = useRemote(async (signal) => {
  detail.value = ''
  try {
    return await props.load(signal)
  } catch (cause) {
    if (!signal.aborted && development) detail.value = cause instanceof Error ? cause.message : String(cause)
    throw cause
  }
}, () => props.load, false)
</script>
<template>
  <section class="panel stack remote-section" :aria-busy="loading">
    <h2>{{ title }}</h2>
    <button :disabled="loading" @click="refresh">
      {{ loading ? 'Consultando…' : 'Consultar / actualizar' }}
    </button>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <details v-if="development && detail"><summary>Detalle técnico</summary><pre>{{ detail }}</pre></details>
    <p v-if="!loading && !error && data !== null && isEmpty?.(data)" role="status">No hay resultados.</p>
    <slot v-else-if="!loading && !error && data !== null" :data="data"><p>Respuesta recibida.</p></slot>
  </section>
</template>
<style scoped>
.remote-section h2 { font-size: 14px; }
.remote-section > button { font-size: 12px; color: #2563eb; background: #eff6ff; border-color: #dbeafe; }
</style>
