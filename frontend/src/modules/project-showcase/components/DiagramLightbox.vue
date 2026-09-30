<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

defineProps<{ src: string; title: string }>()

const emit = defineEmits<{ close: [] }>()
const closeButton = ref<HTMLButtonElement | null>(null)
const zoomed = ref(false)
const dragging = ref(false)
const offset = ref({ x: 0, y: 0 })

let dragStart: { x: number; y: number; offsetX: number; offsetY: number } | null = null
let movedDuringDrag = false
let suppressClick = false
let previousOverflow = ''

function toggleZoom() {
  if (suppressClick) {
    suppressClick = false
    return
  }

  zoomed.value = !zoomed.value
  offset.value = { x: 0, y: 0 }
}

function startDrag(event: PointerEvent) {
  if (!zoomed.value) return

  dragStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: offset.value.x,
    offsetY: offset.value.y,
  }
  movedDuringDrag = false
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }
}

function moveDrag(event: PointerEvent) {
  if (!dragStart) return

  const deltaX = event.clientX - dragStart.x
  const deltaY = event.clientY - dragStart.y
  if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
    movedDuringDrag = true
    dragging.value = true
  }
  if (movedDuringDrag) {
    offset.value = { x: dragStart.offsetX + deltaX, y: dragStart.offsetY + deltaY }
  }
}

function stopDrag() {
  if (movedDuringDrag) suppressClick = true
  dragStart = null
  dragging.value = false
}

function cancelDrag() {
  dragStart = null
  dragging.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
})

onUnmounted(() => {
  document.body.style.overflow = previousOverflow
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/90 p-4"
      @click.self="emit('close')"
    >
      <button
        ref="closeButton"
        type="button"
        aria-label="Cerrar diagrama"
        class="absolute right-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1 text-xl text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        @click="emit('close')"
      >
        ×
      </button>
      <img
        :src="src"
        :alt="title"
        role="button"
        tabindex="0"
        draggable="false"
        class="max-h-[85vh] max-w-[90vw] select-none object-contain"
        :class="[zoomed ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in', dragging ? '' : 'transition-transform duration-200']"
        :style="{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoomed ? 2.5 : 1})`, touchAction: 'none' }"
        @click.stop="toggleZoom"
        @keydown.enter.prevent="toggleZoom"
        @keydown.space.prevent="toggleZoom"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="stopDrag"
        @pointercancel="cancelDrag"
      />
      <p class="pointer-events-none absolute bottom-5 rounded-full bg-slate-950/70 px-4 py-2 text-xs text-white/80">
        {{ zoomed ? 'Arrastra para mover · clic para alejar · Esc para cerrar' : 'Clic en la imagen para ampliar · Esc para cerrar' }}
      </p>
    </div>
  </Teleport>
</template>
