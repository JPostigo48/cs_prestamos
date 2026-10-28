<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, onUnmounted, ref } from 'vue'
const props = defineProps<{ title: string; busy?: boolean }>()
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
  <dialog ref="dialog" aria-labelledby="modal-title" :aria-busy="busy" @cancel="cancel">
    <h2 id="modal-title">{{ title }}</h2>
    <slot />
  </dialog>
</template>
