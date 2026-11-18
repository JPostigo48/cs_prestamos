<script setup lang="ts">
import FullRegistrationForm from '../components/FullRegistrationForm.vue'
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-8">
    <section class="registration-shell w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-label="Solicitud de registro">
      <h1 class="mb-4 text-2xl font-bold text-slate-900">Solicitud de registro</h1>
      <FullRegistrationForm />
      <RouterLink to="/login" class="mt-5 inline-block text-sm font-medium text-blue-700 hover:underline">Volver a iniciar sesión</RouterLink>
    </section>
  </main>
</template>
<style scoped>
.registration-shell { max-width: 820px; min-width: 0; }
</style>
