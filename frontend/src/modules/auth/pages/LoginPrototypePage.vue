<template>
  <!-- Marco Estilo Móvil -->
  <div class="w-full max-w-sm h-[680px] bg-white rounded-[32px] shadow-lg overflow-hidden border border-slate-200 flex flex-col relative mx-auto mt-6">
    <div v-show="view === 'main'" class="flex flex-col h-full overflow-hidden">
      <header class="bg-[#1e3a5f] text-white pt-4 pb-3 px-6 text-center rounded-b-[24px] shrink-0">
        <div class="flex items-center justify-center mb-1">
          <img src="/logo.png" alt="Logo" class="w-20 h-20 object-contain">
        </div>
        <h1 class="text-lg font-bold tracking-tight">CS Préstamos</h1>
        <p class="text-[11px] text-blue-200">Escuela de Cs. de la Computación</p>
      </header>

      <main class="px-6 py-2.5 flex flex-col gap-2 flex-grow justify-center overflow-hidden">
        <div class="text-center">
          <h2 class="text-slate-800 font-bold text-lg mb-0.5">Inicia sesión</h2>
          <p class="text-slate-500 text-[11px]">Usa tu cuenta institucional</p>
          <p class="mt-1 text-[10px] font-medium text-amber-700">Prototipo visual: autenticación sin conexión a la API</p>
        </div>

        <button @click="showGoogleView" class="w-full py-2 px-4 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 transition text-slate-700 text-xs font-medium flex items-center justify-center gap-2 shadow-sm cursor-pointer">
          <img src="/images.png" alt="Google Logo" class="w-3.5 h-3.5 object-contain"> Continuar con Google
        </button>

        <div class="flex items-center my-0.5">
          <div class="flex-grow border-t border-slate-200"></div>
          <span class="px-2 text-slate-400 text-[11px]">o</span>
          <div class="flex-grow border-t border-slate-200"></div>
        </div>

        <div class="flex flex-col gap-0.5">
          <label class="text-[9px] font-bold text-slate-600 tracking-wider">CORREO INSTITUCIONAL</label>
          <input type="text" v-model="emailInput" placeholder="usuario@unsa.edu.pe" class="w-full px-3.5 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500">
        </div>

        <div class="flex flex-col gap-0.5">
          <label class="text-[9px] font-bold text-slate-600 tracking-wider">CONTRASEÑA</label>
          <div class="relative">
            <input :type="passwordVisible ? 'text' : 'password'" v-model="password" class="w-full px-3.5 py-1.5 pr-12 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500">
            <span @click="passwordVisible = !passwordVisible" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs cursor-pointer font-medium hover:text-slate-600 select-none">
              {{ passwordVisible ? 'Ocultar' : 'Ver' }}
            </span>
          </div>
        </div>

        <button
          @click="handleLogin"
          class="mt-0.5 w-full cursor-pointer rounded-xl bg-[#1e3a5f] py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#152a45]"
        >
          Ingresar
        </button>

        <div class="text-center">
          <a href="#" @click.prevent="showRegisterView" class="text-blue-600 text-xs font-medium hover:underline">¿No tienes cuenta? Regístrate</a>
        </div>
      </main>

      <footer class="text-center py-2 bg-white border-t border-slate-100 text-[9px] text-slate-400 shrink-0 leading-tight px-4">
        <p>CS Préstamos · Escuela de Ciencias de la Computación</p>
        <p>Solo para uso del personal y estudiantes autorizados</p>
      </footer>
    </div>
    <div v-show="view === 'google'" class="flex flex-col h-full overflow-hidden">
      <header class="bg-[#1e3a5f] text-white pt-4 pb-3 px-6 text-center rounded-b-[24px] shrink-0">
        <div class="flex items-center justify-center mb-1">
          <img src="/logo.png" alt="Logo" class="w-20 h-20 object-contain">
        </div>
        <h1 class="text-lg font-bold tracking-tight">CS Préstamos</h1>
        <p class="text-[11px] text-blue-200">Escuela de Cs. de la Computación</p>
      </header>

      <main class="p-6 flex flex-col gap-3 flex-grow justify-center">
        <div class="flex flex-col items-center justify-center mb-1">
          <div class="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center shadow-sm mb-1.5 p-2 bg-white">
            <img src="/images.png" alt="Google Logo" class="w-full h-full object-contain">
          </div>
          <h2 class="text-center text-slate-800 font-semibold text-sm mb-0.5">Acceso con Google</h2>
          <p class="text-center text-slate-500 text-xs">Ingresa tu correo institucional</p>
          <p class="mt-1 text-center text-[10px] font-medium text-amber-700">Prototipo visual: sin conexión con Google</p>
        </div>

        <div class="flex flex-col gap-1 mt-1">
          <label class="text-[10px] font-bold text-slate-600 tracking-wider">CORREO @UNSA.EDU.PE</label>
          <div class="w-full flex items-center px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 focus-within:border-blue-500">
            <input
              type="text"
              v-model="googleEmailLocal"
              @input="onGoogleEmailInput"
              @keyup.enter="handleGoogleContinue"
              placeholder="usuario"
              class="flex-grow min-w-0 outline-none border-none p-0 bg-transparent text-slate-700"
            >
            <span class="text-slate-400 whitespace-nowrap ml-1">@unsa.edu.pe</span>
          </div>
          <span class="text-[10px] text-slate-400 mt-0.5">Solo cuentas @unsa.edu.pe</span>
        </div>

        <!-- Mensaje de error de validación -->
        <div v-if="googleError" class="flex items-start gap-1.5 bg-red-50 border border-red-200 text-red-600 rounded-xl px-3 py-2 text-[11px]">
          <span>⚠️</span>
          <span>{{ googleError }}</span>
        </div>

        <button @click="handleGoogleContinue" class="w-full py-2.5 bg-[#1e3a5f] hover:bg-[#152a45] transition text-white rounded-xl text-xs font-bold shadow-sm mt-2 cursor-pointer">
          Continuar
        </button>
        <button @click="showMainView" class="w-full py-1.5 text-center text-slate-600 text-xs font-medium hover:text-slate-800 cursor-pointer">
          ← Volver
        </button>
      </main>
      <footer class="text-center py-2 bg-white border-t border-slate-100 text-[9px] text-slate-400 shrink-0 leading-tight px-4">
        <p>CS Préstamos · Escuela de Ciencias de la Computación</p>
        <p>Solo para uso del personal y estudiantes autorizados</p>
      </footer>
    </div>
    <div v-show="view === 'register'" class="flex flex-col h-full bg-white overflow-hidden">
      <header class="bg-[#1e3a5f] text-white pt-4 pb-3 px-6 text-center rounded-b-[24px] shrink-0">
        <div class="flex items-center justify-center mb-1">
          <img src="/logo.png" alt="Logo" class="w-20 h-20 object-contain">
        </div>
        <h1 class="text-lg font-bold tracking-tight">CS Préstamos</h1>
        <p class="text-[10px] text-blue-200">Escuela de Cs. de la Computación</p>
      </header>

      <div class="p-3.5 flex flex-col gap-2.5 flex-grow overflow-hidden">
        <div>
          <h2 class="text-center text-slate-800 font-semibold text-sm mb-0.5">Crear cuenta</h2>
          <p class="text-center text-slate-500 text-[10px]">Usa tu cuenta institucional</p>
        </div>

        <div class="flex flex-col gap-0.5">
          <label class="text-[9px] font-bold text-slate-600 tracking-wider">NOMBRE COMPLETO</label>
          <input type="text" placeholder="Ej. Juan Pérez" class="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500">
        </div>

        <div class="flex flex-col gap-0.5">
          <label class="text-[9px] font-bold text-slate-600 tracking-wider">CORREO INSTITUCIONAL</label>
          <input type="text" placeholder="usuario@unsa.edu.pe" class="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500">
        </div>

        <div class="flex flex-col gap-0.5">
          <label class="text-[9px] font-bold text-slate-600 tracking-wider">CONTRASEÑA</label>
          <div class="relative">
            <input :type="passwordVisibleRegister ? 'text' : 'password'" v-model="registerPassword" class="w-full px-3 py-1.5 pr-10 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500">
            <span @click="passwordVisibleRegister = !passwordVisibleRegister" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] cursor-pointer font-medium hover:text-slate-600 select-none">
              {{ passwordVisibleRegister ? 'Ocultar' : 'Ver' }}
            </span>
          </div>
        </div>

        <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
          La solicitud de registro y la aceptación de términos se conectarán con la API cuando estén disponibles. Esta vista solo conserva la maquetación inicial.
        </div>

        <button disabled class="w-full cursor-not-allowed rounded-xl bg-slate-400 py-2 text-xs font-semibold text-white opacity-70">
          Registro no disponible en el prototipo
        </button>
        <div class="text-center">
          <a href="#" @click.prevent="showMainView" class="text-blue-600 text-xs font-medium hover:underline">¿Ya tienes cuenta? Inicia sesión</a>
        </div>
      </div>

      <footer class="text-center py-2 bg-white border-t border-slate-100 text-[9px] text-slate-400 shrink-0 leading-tight px-4">
        <p>CS Préstamos · Escuela de Ciencias de la Computación</p>
        <p>Solo para uso del personal y estudiantes autorizados</p>
      </footer>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

type LoginView = 'main' | 'google' | 'register'

const view = ref<LoginView>('main')
const emailInput = ref('')
const password = ref('')
const passwordVisible = ref(false)
const googleEmailLocal = ref('')
const googleError = ref<string | null>(null)
const passwordVisibleRegister = ref(false)
const registerPassword = ref('')

function handleLogin(): void {
  if (!emailInput.value.trim().toLowerCase().endsWith('@unsa.edu.pe') || !password.value) {
    window.alert('Ingresa tu correo institucional y contraseña.')
    return
  }

  window.alert('Esta pantalla es un prototipo visual. La autenticación aún no está conectada.')
}

function showMainView(): void {
  view.value = 'main'
}

function showGoogleView(): void {
  view.value = 'google'
  googleEmailLocal.value = ''
  googleError.value = null
}

function stripGoogleDomain(value: string): string {
  const domain = '@unsa.edu.pe'
  return value.toLowerCase().endsWith(domain) ? value.slice(0, -domain.length) : value
}

function onGoogleEmailInput(): void {
  googleError.value = null
  googleEmailLocal.value = stripGoogleDomain(googleEmailLocal.value)
}

function handleGoogleContinue(): void {
  const local = stripGoogleDomain(googleEmailLocal.value.trim())
  if (!local || /[\s@]/.test(local)) {
    googleError.value = 'Solo se permiten correos institucionales @unsa.edu.pe'
    return
  }

  googleError.value = null
  window.alert('El acceso con Google aún no está conectado. Esta pantalla es un prototipo visual.')
}

function showRegisterView(): void {
  view.value = 'register'
}
</script>
