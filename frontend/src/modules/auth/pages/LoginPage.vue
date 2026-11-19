<template>
  <div class="login-shell box-border h-dvh w-full overflow-x-hidden overflow-y-auto lg:overflow-hidden">
    <div class="login-deco" aria-hidden="true">
      <span class="login-deco__circle login-deco__circle--1"></span>
      <span class="login-deco__circle login-deco__circle--2"></span>
      <span class="login-deco__circle login-deco__circle--3"></span>
      <span class="login-deco__circle login-deco__circle--4"></span>
      <span class="login-deco__circle login-deco__circle--5"></span>
    </div>

    <header
      class="relative z-10 flex flex-col items-center gap-4 px-6 pt-8 text-center lg:absolute lg:left-8 lg:top-6 lg:flex-row lg:items-center lg:gap-4 lg:p-0 lg:text-left"
    >
      <span class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/90 p-2 lg:h-20 lg:w-20">
        <img src="/logo.png" alt="" class="h-full w-full object-contain" />
      </span>
      <span class="flex flex-col">
        <span class="text-2xl font-bold leading-tight text-white">CS Préstamos</span>
        <span class="text-sm text-white/70">Escuela de Ciencias de la Computación</span>
      </span>
    </header>

    <main
      class="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-10 px-6 py-8 lg:grid lg:grid-cols-[1.4fr_1fr] lg:gap-16 lg:px-16 lg:pb-2 lg:pt-24"
    >
      <img
        src="/login-ilustracion.png"
        alt=""
        class="login-illustration hidden min-w-0 w-full h-auto max-w-[900px] max-h-[82dvh] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.30)] lg:block lg:justify-self-center"
        @error="(event) => ((event.target as HTMLImageElement).style.display = 'none')"
      />

      <div class="w-full max-w-[440px] shrink-0 lg:justify-self-center">
        <section aria-label="Acceso al sistema" class="flex justify-center">
          <LoginForm
            v-model:email="email"
            v-model:password="password"
            :loading="loading"
            :error="error"
            @submit="signIn"
            @register="router.push('/register')"
            @google="router.push('/login/google')"
          />
        </section>
        <footer class="mt-6 text-center text-xs text-white/60">
          CS Préstamos · Escuela de Ciencias de la Computación
        </footer>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoginForm from '../components/RealLoginForm.vue'
import { authenticate, saveSession } from '../api/auth-api'
import { safeDestination } from '../access-policy'

const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function signIn(): Promise<void> {
  if (loading.value) return
  error.value = null
  loading.value = true
  try {
    const session = await authenticate(email.value.trim(), password.value)
    saveSession(session)
    await router.replace(safeDestination(route.query.redirect, session.user.role))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-shell {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1b3540 0%, #22434d 100%);
  color: #ffffff;
}

.login-deco {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.login-deco__circle {
  position: absolute;
  display: block;
  border-radius: 9999px;
}

.login-deco__circle--1 {
  top: -7rem;
  left: -5rem;
  width: 20rem;
  height: 20rem;
  background: rgb(255 255 255 / 8%);
}

.login-deco__circle--2 {
  top: -4rem;
  left: 38%;
  width: 15rem;
  height: 15rem;
  border: 1px solid rgb(255 255 255 / 15%);
}

.login-deco__circle--3 {
  top: -6rem;
  right: -4rem;
  width: 18rem;
  height: 18rem;
  background: rgb(255 255 255 / 7%);
}

.login-deco__circle--4 {
  right: 8%;
  bottom: -7rem;
  width: 22rem;
  height: 22rem;
  background: rgb(255 255 255 / 9%);
}

.login-deco__circle--5 {
  bottom: 6%;
  left: -3rem;
  width: 13rem;
  height: 13rem;
  border: 1px solid rgb(255 255 255 / 15%);
}

@media (min-width: 1024px) and (max-height: 700px) {
  .login-main {
    padding-top: 5rem;
    padding-bottom: 1rem;
  }
  .login-illustration {
    max-height: 70dvh;
  }
}
</style>
