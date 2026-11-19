<template>
  <div
    class="mx-auto w-full max-w-[420px] rounded-3xl border border-white/20 bg-white/10 p-8 text-white shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:p-10 lg:max-w-[500px] lg:p-12 [@media(max-height:800px)]:p-8 [@media(max-height:700px)]:p-6!"
  >
    <div class="text-left">
      <h2 class="text-3xl lg:text-4xl font-semibold tracking-wide text-white">Inicia sesión</h2>
      <p class="mt-2 text-base lg:text-lg text-white/70">Usa tu cuenta institucional</p>
    </div>

    <div class="mt-7 space-y-5 [@media(max-height:800px)]:space-y-4 [@media(max-height:700px)]:mt-5 [@media(max-height:700px)]:space-y-3!">
      <button
        type="button"
        :disabled="loading"
        class="flex h-11 lg:h-14 w-full items-center justify-center gap-3 rounded-lg border border-white/25 bg-white/10 px-4 text-sm lg:text-base font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a5d8cc]/60 disabled:cursor-not-allowed disabled:opacity-60"
        @click="emit('google')"
      >
        <img src="/images.png" alt="" class="h-5 w-5 object-contain" />
        Continuar con Google
      </button>

      <div class="text-center text-white/70">o</div>

      <form
        class="space-y-4 lg:space-y-5 [@media(max-height:800px)]:space-y-4 [@media(max-height:700px)]:space-y-3!"
        @submit.prevent="emit('submit')"
      >
        <div>
          <label
            for="login-email"
            class="mb-1.5 block text-xs lg:text-sm uppercase tracking-wide text-white/80"
            >Correo institucional</label
          >
          <input
            id="login-email"
            v-model.trim="email"
            type="email"
            autocomplete="username"
            required
            placeholder="usuario@unsa.edu.pe"
            class="h-12 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#a5d8cc] focus:ring-2 focus:ring-[#a5d8cc]/30"
          />
        </div>
        <div>
          <label
            for="login-password"
            class="mb-1.5 block text-xs lg:text-sm uppercase tracking-wide text-white/80"
            >Contraseña</label
          >
          <div class="relative">
            <LockKeyhole
              v-show="!password"
              :size="18"
              class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60 transition-opacity duration-150"
            />
            <input
              id="login-password"
              v-model="password"
              :type="passwordVisible ? 'text' : 'password'"
              :class="password ? 'pl-4' : 'pl-11'"
              autocomplete="current-password"
              required
              class="h-12 w-full rounded-lg border border-white/20 bg-white/10 pr-12 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#a5d8cc] focus:ring-2 focus:ring-[#a5d8cc]/30"
            />
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a5d8cc]/60"
              :aria-label="passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              @click="passwordVisible = !passwordVisible"
            >
              <EyeOff v-if="passwordVisible" :size="19" />
              <Eye v-else :size="19" />
            </button>
          </div>
        </div>

        <p
          v-if="error"
          role="alert"
          class="rounded-lg border border-red-400/30 bg-red-500/20 px-3 py-2 text-sm text-red-100"
        >
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="flex h-11 w-full items-center justify-center rounded-lg bg-[#a5d8cc] px-4 text-sm font-semibold text-[#14282f] transition hover:bg-[#b8e3d9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a5d8cc]/60 disabled:cursor-wait disabled:opacity-60"
        >
          {{ loading ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>

      <button
        type="button"
        class="block w-full text-center text-sm text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a5d8cc]/60"
        @click="emit('register')"
      >
        ¿No tienes cuenta? <span class="font-bold text-white">Solicita tu registro</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff, LockKeyhole } from '@lucide/vue'

withDefaults(
  defineProps<{
    prototype?: boolean
    loading?: boolean
    error?: string | null
  }>(),
  { loading: false, error: null },
)

const email = defineModel<string>('email', { required: true })
const password = defineModel<string>('password', { required: true })
const emit = defineEmits<{ submit: []; google: []; register: [] }>()
const passwordVisible = ref(false)
</script>
