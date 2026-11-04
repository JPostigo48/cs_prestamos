<script setup lang="ts">
import { computed } from 'vue'
import {
  BookOpen,
  Newspaper,
  GraduationCap,
  Clapperboard,
  FlaskConical,
  Puzzle,
  Gem,
  Cpu,
  Trophy,
  Package,
} from '@lucide/vue'
const props = defineProps<{ name: string; size?: number }>()
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
const icon = computed(() => {
  const name = normalize(props.name)
  if (name.includes('libro')) return BookOpen
  if (name.includes('revista')) return Newspaper
  if (name.includes('tesis')) return GraduationCap
  if (name.includes('audiovisual') || name.includes('clapper') || name.includes('video')) return Clapperboard
  if (name.includes('laboratorio')) return FlaskConical
  if (name.includes('juego')) return Puzzle
  if (name.includes('coleccion')) return Gem
  if (name.includes('electronico') || name.includes('equipo')) return Cpu
  if (name.includes('deporte')) return Trophy
  return Package
})
</script>
<template><component :is="icon" :size="size ?? 22" aria-hidden="true" /></template>
