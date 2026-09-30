<script setup lang="ts">
defineProps<{ title: string; detail: string }>()
</script>

<template>
  <div class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
    <h2 class="text-lg font-semibold text-slate-800">{{ title }}</h2>
    <p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{{ detail }}</p>
  </div>
</template>
