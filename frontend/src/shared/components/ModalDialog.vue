<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, onUnmounted, ref } from 'vue'
import { X } from '@lucide/vue'
const props = defineProps<{ title: string; subtitle?: string; busy?: boolean; mobileSheet?: boolean; compact?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  dialog.value?.showModal()
})
onBeforeUnmount(() => {
  dialog.value?.close()
  document.body.style.overflow = previousOverflow
})
onUnmounted(() => {
  void nextTick(() => {
    if (previousFocus?.isConnected) previousFocus.focus()
    else document.getElementById('app-content')?.focus()
  })
})
function cancel(event: Event) {
  event.preventDefault()
  if (!props.busy) emit('close')
}
</script>
<template>
  <dialog ref="dialog" :class="{ 'mobile-sheet': mobileSheet, compact }" aria-labelledby="modal-title" :aria-busy="busy" @cancel="cancel">
    <header class="modal-heading"><div><h2 id="modal-title">{{ title }}</h2><p v-if="subtitle">{{ subtitle }}</p></div><button type="button" aria-label="Cerrar diálogo" :disabled="busy" @click="emit('close')"><X :size="20" aria-hidden="true" /></button></header>
    <slot />
  </dialog>
</template>
<style scoped>
.modal-heading { display: flex; justify-content: space-between; align-items: start; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
.modal-heading h2 { font-size: 18px; font-weight: 800; margin: 0; }
.modal-heading p { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.modal-heading button { display: flex; flex-shrink: 0; padding: 4px; border: 0; background: transparent; color: #64748b; }
</style>
