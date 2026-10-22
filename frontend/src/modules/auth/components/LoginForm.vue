<template>
  <div class="flex h-full min-h-0 flex-col bg-white text-slate-900">
    <header class="shrink-0 rounded-b-[28px] bg-[#1e3a5f] px-6 py-7 text-center text-white sm:py-8">
      <img src="/logo.png" alt="" class="mx-auto h-20 w-20 object-contain sm:h-24 sm:w-24" />
      <h1 class="mt-2 text-xl font-bold tracking-tight sm:text-2xl">CS Préstamos</h1>
      <p class="mt-1 text-xs text-blue-100 sm:text-sm">Escuela de Ciencias de la Computación</p>
    </header>

    <main class="flex flex-1 flex-col justify-center px-7 py-7 sm:px-10">
      <div class="text-center">
        <h2 class="text-2xl font-bold">Inicia sesión</h2>
        <p class="mt-1 text-sm text-slate-500">Usa tu cuenta institucional</p>
        <p v-if="prototype" class="mt-2 text-xs text-amber-700">Prototipo visual: sin conexión a la API</p>
      </div>

      <div class="mt-7 space-y-5">
        <button
          type="button"
          :disabled="!prototype"
          class="flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium shadow-sm transition enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          @click="emit('google')"
        >
          <img src="/images.png" alt="" class="h-5 w-5 object-contain" />
          {{ prototype ? 'Continuar con Google' : 'Google aún no disponible' }}
        </button>

        <div class="flex items-center gap-3 text-xs text-slate-400">
          <span class="h-px flex-1 bg-slate-200"></span>o<span class="h-px flex-1 bg-slate-200"></span>
        </div>

        <form class="space-y-4" @submit.prevent="emit('submit')">
          <div>
            <label for="login-email" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Correo institucional</label>
            <div class="relative">
              <Mail :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="login-email"
                v-model.trim="email"
                type="email"
                autocomplete="username"
                required
                placeholder="usuario@unsa.edu.pe"
                class="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          <div>
            <label for="login-password" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Contraseña</label>
            <div class="relative">
              <LockKeyhole :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="login-password"
                v-model="password"
                :type="passwordVisible ? 'text' : 'password'"
                autocomplete="current-password"
                required
                class="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-12 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                :aria-label="passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                @click="passwordVisible = !passwordVisible"
              >
                <EyeOff v-if="passwordVisible" :size="19" />
                <Eye v-else :size="19" />
              </button>
            </div>
          </div>

          <p v-if="error" role="alert" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

          <button
            type="submit"
            :disabled="loading"
            class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1e3a5f] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#294f82] disabled:cursor-wait disabled:opacity-60"
          >
            {{ loading ? 'Ingresando…' : 'Ingresar' }}
            <ArrowRight v-if="!loading" :size="17" />
          </button>
        </form>

        <button type="button" class="w-full text-center text-sm font-medium text-blue-600 hover:underline" @click="emit('register')">
          ¿No tienes cuenta? Solicita tu registro
        </button>
      </div>
    </main>

    <footer class="shrink-0 border-t border-slate-100 px-5 py-3 text-center text-[11px] leading-relaxed text-slate-500">
      CS Préstamos · Escuela de Ciencias de la Computación
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from '@lucide/vue'

withDefaults(defineProps<{
  prototype?: boolean
  loading?: boolean
  error?: string | null
}>(), { prototype: false, loading: false, error: null })

const email = defineModel<string>('email', { required: true })
const password = defineModel<string>('password', { required: true })
const emit = defineEmits<{ submit: []; google: []; register: [] }>()
const passwordVisible = ref(false)
</script>
