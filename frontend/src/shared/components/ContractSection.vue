<script setup lang="ts">
import { ref, shallowRef, onBeforeUnmount } from 'vue'
import { provisionalRequest, type ProvisionalId } from '../api/provisional-contracts'
import { errorMessage } from '../composables/useRemote'
const props = defineProps<{
  title: string
  contract: ProvisionalId
  params?: Record<string, string>
  query?: Record<string, string>
}>()
const data = shallowRef<unknown>(null)
const loading = ref(false),
  error = ref('')
const controller = new AbortController()
onBeforeUnmount(() => controller.abort())
async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  data.value = null
  try {
    data.value = await provisionalRequest(props.contract, {
      params: props.params,
      query: props.query,
      signal: controller.signal,
    })
  } catch (cause) {
    if (!controller.signal.aborted) error.value = errorMessage(cause)
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <section class="panel stack contract-section">
    <h2>{{ title }}</h2>
    <button :disabled="loading" @click="load">
      {{ loading ? 'Consultando…' : 'Consultar / actualizar' }}
    </button>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <slot v-if="data" :data="data"><p>Respuesta recibida.</p></slot>
  </section>
</template>
<style scoped>
.contract-section h2 { font-size: 14px; }
.contract-section > button { font-size: 12px; color: #2563eb; background: #eff6ff; border-color: #dbeafe; }
</style>
