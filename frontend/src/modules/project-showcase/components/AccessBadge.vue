<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { LockKeyhole } from '@lucide/vue'
import type { OpenApiOperation } from '../types'
import { accessDescription } from '../services/openApiPresentation'

const props = defineProps<{ operation: OpenApiOperation }>()
const description = computed(() => accessDescription(props.operation))
const id = useId()
const hovered = ref(false), focused = ref(false), pinned = ref(false), dismissed = ref(false)
const visible = computed(() => (hovered.value || focused.value || pinned.value) && !dismissed.value)
const placement = ref<Record<string, string>>({})
function position(event: Event) {
  const element = event.currentTarget as HTMLElement | null
  if (!element?.getBoundingClientRect) return
  const rect = element.getBoundingClientRect()
  const width = Math.min(320, window.innerWidth - 32)
  placement.value = {
    width: `${width}px`,
    left: `${Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16))}px`,
    ...(rect.top < window.innerHeight / 2 ? { top: `${rect.bottom}px` } : { bottom: `${window.innerHeight - rect.top}px` }),
  }
}
function close() { dismissed.value = true; pinned.value = false }
function toggle() { if (pinned.value) close(); else { pinned.value = true; dismissed.value = false } }
onMounted(() => {
  document.addEventListener?.('scroll', close, true)
  if (typeof window !== 'undefined') window.addEventListener('resize', close)
})
onBeforeUnmount(() => {
  document.removeEventListener?.('scroll', close, true)
  if (typeof window !== 'undefined') window.removeEventListener('resize', close)
})
</script>

<template>
  <span v-if="description" class="access-badge" @mouseenter="hovered = true; dismissed = false; position($event)" @mouseleave="hovered = false" @keydown.esc.stop.prevent="close">
    <button type="button" class="access-trigger" :aria-label="description" :aria-describedby="visible ? id : undefined" :aria-expanded="visible" @focus="focused = true; dismissed = false; position($event)" @blur="focused = false; pinned = false" @click.stop.prevent="position($event); toggle()">
      <LockKeyhole :size="15" aria-hidden="true" />
    </button>
    <span v-if="visible" :id="id" role="tooltip" class="access-tooltip" :style="placement">{{ description }}<span v-if="operation['x-access-constraints'] || operation['x-authentication']?.description" class="access-detail">{{ operation['x-access-constraints'] || operation['x-authentication']?.description }}</span></span>
  </span>
  <span v-else class="public-badge">Público</span>
</template>

<style scoped>
.access-badge { position: relative; display: inline-flex; flex-shrink: 0; }
.access-trigger { display: inline-flex; align-items: center; justify-content: center; width: 1.8rem; height: 1.8rem; border: 1px solid #cbd5e1; border-radius: .5rem; background: #f8fafc; color: #334155; cursor: pointer; }
.access-trigger:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.access-tooltip { position: fixed; z-index: 50; max-width: calc(100vw - 2rem); max-height: calc(100dvh - 2rem); overflow: auto; padding: .7rem; border-radius: .5rem; background: #0f172a; color: white; font-size: .75rem; font-weight: 500; overflow-wrap: anywhere; box-shadow: 0 4px 12px #0003; }
.access-detail { display: block; margin-top: .4rem; font-weight: 400; }
.public-badge { color: #475569; font-size: .75rem; }
</style>
