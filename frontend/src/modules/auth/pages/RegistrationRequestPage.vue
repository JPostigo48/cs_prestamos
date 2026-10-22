<template>
  <main class="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-8">
    <form class="w-full max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" @submit.prevent="submit">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Solicitud de registro</h1>
        <p class="mt-2 text-sm text-slate-600">La solicitud deberá ser aprobada antes de habilitar una cuenta.</p>
      </div>
      <label class="block text-sm font-medium text-slate-700">Nombre completo
        <input v-model.trim="name" required minlength="2" maxlength="180" class="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-600" />
      </label>
      <label class="block text-sm font-medium text-slate-700">Tipo de usuario
        <select v-model="userType" class="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3">
          <option value="ESTUDIANTE">Estudiante</option>
          <option value="DOCENTE">Docente</option>
          <option value="ADMINISTRATIVO">Personal administrativo</option>
        </select>
      </label>
      <label class="block text-sm font-medium text-slate-700">Identificador institucional
        <input v-model.trim="institutionalId" maxlength="80" class="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-600" />
      </label>
      <label class="block text-sm font-medium text-slate-700">Información para verificar la vinculación
        <textarea v-model.trim="evidence" required rows="3" class="mt-1.5 w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-600" />
      </label>
      <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
      <p v-if="success" role="status" class="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Solicitud registrada. Un operador revisará la vinculación antes de habilitar la cuenta.</p>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <RouterLink to="/login" class="text-sm font-medium text-blue-600 hover:underline">Volver a iniciar sesión</RouterLink>
        <button type="submit" :disabled="loading || success" class="rounded-lg bg-[#1e3a5f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{{ loading ? 'Enviando…' : 'Enviar solicitud' }}</button>
      </div>
    </form>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { submitRegistrationRequest } from '../api/auth-api'

const name = ref('')
const userType = ref<'ESTUDIANTE' | 'DOCENTE' | 'ADMINISTRATIVO'>('ESTUDIANTE')
const institutionalId = ref('')
const evidence = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

async function submit(): Promise<void> {
  if (loading.value) return
  loading.value = true
  error.value = null
  try {
    await submitRegistrationRequest({
      name: name.value,
      userType: userType.value,
      institutionalId: institutionalId.value || undefined,
      evidence: evidence.value ? [evidence.value] : [],
    })
    success.value = true
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo enviar la solicitud.'
  } finally {
    loading.value = false
  }
}
</script>
