<template>
  <div class="login-shell">
    <section class="login-card" aria-label="Acceso al sistema">
      <LoginForm
        v-model:email="email"
        v-model:password="password"
        class="flex-1"
        :loading="loading"
        :error="error"
        @submit="signIn"
        @register="router.push('/register')"
        @google="router.push('/login/google')"
      />
    </section>
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
  min-height: 100dvh;
  background: white;
}
.login-card {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: white;
}
@media (min-width: 640px) {
  .login-shell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #f8fafc;
  }
  .login-card {
    width: 100%;
    max-width: 480px;
    min-height: min(900px, calc(100dvh - 48px));
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 28px;
    box-shadow: 0 16px 36px rgb(15 23 42 / 10%);
  }
}
</style>
