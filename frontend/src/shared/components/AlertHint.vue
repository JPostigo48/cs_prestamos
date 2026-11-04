<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { CircleAlert } from '@lucide/vue'
defineProps<{ message: string; label?: string }>()
const id = useId(), open = ref(false), root = ref<HTMLElement>()
const position = ref({ left: '8px', top: '8px' })
function show() {
  const rect = root.value?.getBoundingClientRect?.()
  if (rect) {
    const width = Math.min(240, window.innerWidth - 32)
    position.value = { left: `${Math.max(16, Math.min(rect.left, window.innerWidth - width - 16))}px`, top: `${Math.max(16, Math.min(rect.bottom + 6, window.innerHeight - 180))}px` }
  }
  open.value = true
}
function outside(event: Event) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>
<template>
  <span ref="root" class="alert-hint" @mouseenter="show" @mouseleave="open = false" @keydown.esc.stop.prevent="open = false">
    <button type="button" :aria-label="label || 'Más información'" :aria-describedby="id" :aria-expanded="open" @focus="show" @blur="open = false" @click="show"><CircleAlert :size="17" aria-hidden="true" /></button>
    <span :id="id" role="tooltip" :class="open ? 'hint-popup' : 'sr-only'" :style="open ? position : undefined">{{ message }}</span>
  </span>
</template>
<style scoped>
.alert-hint { display: inline-flex; position: relative; vertical-align: middle; }
.alert-hint button { display: inline-flex; padding: 4px; background: transparent; border: 0; color: #a16207; }
.alert-hint button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.hint-popup { position: fixed; z-index: 20; box-sizing: border-box; width: min(240px, calc(100vw - 32px)); max-height: min(160px, calc(100dvh - 32px)); overflow: auto; padding: 10px; border-radius: 8px; background: #1e293b; color: white; font-size: 12px; font-weight: 400; line-height: 1.5; overflow-wrap: anywhere; box-shadow: 0 4px 12px #0003; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style>
