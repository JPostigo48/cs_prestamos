<script setup lang="ts">
import { ref } from 'vue'
import { startGoogle } from '../api/access-flows-api'
import { errorMessage } from '../../../shared/composables/useRemote'
const email = ref(''),
  error = ref(''),
  sending = ref(false)
async function submit() {
  if (sending.value) return
  sending.value = true
  error.value = ''
  try {
    const result = await startGoogle(email.value.trim())
    window.location.assign(result.authorizationUrl)
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    sending.value = false
  }
}
</script>
<template>
  <main class="min-h-dvh bg-slate-50 px-4 py-12">
    <form
      class="mx-auto max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      @submit.prevent="submit"
    >
      <img src="/logo.png" alt="" class="mx-auto h-20 w-20 object-contain" />
      <h1 class="text-2xl font-bold text-[#1e3a5f]">Continuar con Google</h1>
      <p>
        La integración con el proveedor está pendiente en el backend. El correo no inicia sesión por
        sí mismo.
      </p>
      <label class="block"
        >Correo institucional<input
          v-model.trim="email"
          type="email"
          required
          autocomplete="username"
          class="mt-2 w-full rounded-lg border border-slate-300 p-3"
      /></label>
      <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-3 text-red-800">{{ error }}</p>
      <button
        :disabled="sending"
        class="rounded-lg bg-[#1e3a5f] px-5 py-3 text-white disabled:opacity-50"
      >
        {{ sending ? 'Conectando…' : 'Solicitar autorización de Google' }}
      </button>
      <RouterLink to="/login" class="block text-blue-700 underline">Volver</RouterLink>
    </form>
  </main>
</template>
