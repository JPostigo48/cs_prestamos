<script setup lang="ts">
import { computed } from 'vue'
import { BookOpen, Monitor, Trophy, Package } from '@lucide/vue'
const props = defineProps<{ name: string; size?: number }>()
const icon = computed(() => /libro|biblioteca/i.test(props.name) ? BookOpen : /deport/i.test(props.name) ? Trophy : /electr|tecnol|equipo/i.test(props.name) ? Monitor : Package)
</script>
<template><component :is="icon" :size="size ?? 22" aria-hidden="true" /></template>
