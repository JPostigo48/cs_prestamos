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
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return
  const controls = [...dialog.value.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea, [tabindex]',
  )].filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length > 0)
  const first = controls[0]
  const last = controls.at(-1)
  if (!first) {
    event.preventDefault()
    dialog.value.focus()
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>
<template>
  <dialog ref="dialog" tabindex="-1" :class="{ 'mobile-sheet': mobileSheet, compact }" aria-labelledby="modal-title" :aria-busy="busy" @cancel="cancel" @keydown="trapFocus">
    <header class="modal-heading"><div><h2 id="modal-title">{{ title }}</h2><p v-if="subtitle">{{ subtitle }}</p></div><button type="button" aria-label="Cerrar diálogo" :disabled="busy" @click="emit('close')"><X :size="20" aria-hidden="true" /></button></header>
    <slot />
  </dialog>
</template>
<style scoped>
dialog { width: 100%; max-width: min(560px, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); overflow: auto; border: 0; border-radius: .8rem; padding: 1.5rem; margin: auto; color: #172b44; background: white; box-shadow: 0 24px 48px #0f172a40; overflow-wrap: anywhere; }
dialog::backdrop { background: #0f172a66; backdrop-filter: blur(4px); }
dialog.compact { max-width: min(448px, calc(100vw - 2rem)); }
button:focus-visible { outline: 2px solid #2563eb; outline-offset: 3px; }
.modal-heading { display: flex; justify-content: space-between; align-items: start; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
.modal-heading h2 { font-size: 18px; font-weight: 800; margin: 0; }
.modal-heading p { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.modal-heading button { display: flex; flex-shrink: 0; padding: 4px; border: 0; background: transparent; color: #64748b; }
</style>
