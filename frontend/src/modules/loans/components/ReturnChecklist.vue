<script setup lang="ts">
defineProps<{ parts: { id: string; nombre: string }[]; modelValue: Record<string, boolean | null>; disabled: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, boolean | null>] }>()
</script>
<template>
  <fieldset :disabled="disabled" class="stack">
    <legend>Checklist de partes y accesorios históricos</legend>
    <p v-if="parts.length === 0">Snapshot confirmado sin componentes: se enviará una lista vacía explícita.</p>
    <label v-for="part in parts" :key="part.id">{{ part.nombre }}
      <select :value="modelValue[part.id] === null || modelValue[part.id] === undefined ? '' : String(modelValue[part.id])" required @change="emit('update:modelValue', { ...modelValue, [part.id]: ($event.target as HTMLSelectElement).value === '' ? null : ($event.target as HTMLSelectElement).value === 'true' })">
        <option value="">Seleccionar resultado</option><option value="true">Recibido</option><option value="false">Faltante</option>
      </select>
    </label>
    <p>No se guarda por separado: forma parte del único cierre integral.</p>
  </fieldset>
</template>
