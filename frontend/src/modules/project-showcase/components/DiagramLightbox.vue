<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

defineProps<{ src: string; title: string }>()

const emit = defineEmits<{ close: [] }>()
const closeButton = ref<HTMLButtonElement | null>(null)
const image = ref<HTMLImageElement | null>(null)
const zoom = ref(1)
const dragging = ref(false)
const offset = ref({ x: 0, y: 0 })

let dragStart: { x: number; y: number; offsetX: number; offsetY: number } | null = null
let movedDuringDrag = false
let suppressClick = false
let previousOverflow = ''

function changeZoom(nextZoom: number, clientX?: number, clientY?: number) {
  const next = Math.min(8, Math.max(1, nextZoom))
  if (next === zoom.value) return

  if (next === 1) {
    offset.value = { x: 0, y: 0 }
  } else if (image.value && clientX !== undefined && clientY !== undefined) {
    const bounds = image.value.getBoundingClientRect()
    const centerX = bounds.left + bounds.width / 2 - offset.value.x
    const centerY = bounds.top + bounds.height / 2 - offset.value.y
    const ratio = next / zoom.value
    offset.value = {
      x: clientX - centerX - ratio * (clientX - centerX - offset.value.x),
      y: clientY - centerY - ratio * (clientY - centerY - offset.value.y),
    }
  }

  zoom.value = next
}

function zoomIn(event?: MouseEvent) {
  if (suppressClick) {
    suppressClick = false
    return
  }

  changeZoom(zoom.value + 0.5, event?.clientX, event?.clientY)
}

function zoomOut(event: MouseEvent) {
  changeZoom(zoom.value - 0.5, event.clientX, event.clientY)
}

function onWheel(event: WheelEvent) {
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1)
  changeZoom(zoom.value * Math.exp(-delta * 0.002), event.clientX, event.clientY)
}

function startDrag(event: PointerEvent) {
  if (zoom.value <= 1 || event.button !== 0) return

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
  if (movedDuringDrag) {
    suppressClick = true
    window.setTimeout(() => { suppressClick = false }, 0)
  }
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
        ref="image"
        :src="src"
        :alt="title"
        role="button"
        tabindex="0"
        draggable="false"
        class="max-h-[85vh] max-w-[90vw] select-none object-contain"
        :class="zoom > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'"
        :style="{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`, touchAction: 'none' }"
        @click.stop="zoomIn"
        @contextmenu.prevent.stop="zoomOut"
        @wheel.prevent="onWheel"
        @keydown.enter.prevent="zoomIn()"
        @keydown.space.prevent="zoomIn()"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="stopDrag"
        @pointercancel="cancelDrag"
      />
      <p class="pointer-events-none absolute bottom-5 max-w-[calc(100vw-2rem)] rounded-full bg-slate-950/70 px-4 py-2 text-center text-xs text-white/80">
        {{ Math.round(zoom * 100) }} % · Clic o rueda arriba: acercar · clic derecho o rueda abajo: alejar · arrastra para mover · Esc: cerrar
      </p>
    </div>
  </Teleport>
</template>
