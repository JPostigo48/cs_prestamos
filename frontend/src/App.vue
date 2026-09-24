<template>
  <!-- Marco Estilo Móvil -->
  <div class="w-full max-w-sm h-[680px] bg-white rounded-[32px] shadow-lg overflow-hidden border border-slate-200 flex flex-col relative mx-auto mt-6">

    <!-- ================= VISTA 1: INICIO DE SESIÓN PRINCIPAL ================= -->
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
          :disabled="loggingIn"
          class="w-full py-2 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all duration-200 mt-0.5"
          :class="loggingIn ? 'bg-[#3b659c]' : 'bg-[#1e3a5f] hover:bg-[#152a45]'"
        >
          {{ loggingIn ? 'Ingresando...' : 'Ingresar' }}
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

    <!-- ================= VISTA 2: ACCESO CON GOOGLE ================= -->
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

    <!-- ================= VISTA 3: CREAR CUENTA Y REGLAS DE NEGOCIO ================= -->
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

        <!-- Contenedor scroll de Reglas de Negocio -->
        <div class="border border-slate-200 rounded-xl flex flex-col flex-grow overflow-hidden bg-slate-50">
          <div class="bg-slate-100 px-3 py-1.5 border-b border-slate-200 shrink-0">
            <h3 class="font-bold text-slate-800 text-[11px]">Reglas de Negocio</h3>
          </div>

          <div ref="registerScroll" @scroll="checkRegisterScroll" class="p-2.5 overflow-y-auto text-[10px] text-slate-700 space-y-2.5">
            <div>
              <h4 class="font-bold text-slate-800 mb-0.5">Acceso y Disponibilidad</h4>
              <ul class="list-disc pl-3 space-y-0.5 text-slate-600">
                <li>RN-01. Solo podrán utilizar el sistema estudiantes, docentes y personal administrativo vinculados actualmente con la EPCC.</li>
                <li>RN-02. La cuenta asignada a un usuario es personal e intransferible.</li>
                <li>RN-03. Todo préstamo está sujeto a la disponibilidad de ejemplares del inventario.</li>
                <li>RN-04. Un ejemplar solo puede estar asociado a un préstamo activo a la vez.</li>
                <li>RN-05. Un recurso puede continuar apareciendo disponible mientras exista al menos uno de sus ejemplares disponible.</li>
                <li>RN-06. Cada categoría de recurso puede tener un tiempo máximo de préstamo diferente.</li>
                <li>RN-07. Antes de realizar un préstamo debe verificarse que el usuario se encuentre habilitado.</li>
              </ul>
            </div>

            <div>
              <h4 class="font-bold text-slate-800 mb-0.5">Responsabilidad y Uso</h4>
              <ul class="list-disc pl-3 space-y-0.5 text-slate-600">
                <li>RN-08. El usuario se compromete al buen uso de los recursos prestados.</li>
                <li>RN-09. Los recursos prestados no pueden utilizarse con fines de lucro.</li>
                <li>RN-10. El usuario es responsable por pérdida, robo o daño ocurrido mientras tenga asignado un ejemplar.</li>
                <li>RN-11. Todo ejemplar debe devolverse dentro de la fecha u hora establecida.</li>
                <li>RN-12. Los retrasos pueden generar restricciones o consecuencias según las reglas vigentes.</li>
                <li>RN-13. Las restricciones de préstamo pueden variar según el tipo de usuario.</li>
              </ul>
            </div>

            <div>
              <h4 class="font-bold text-slate-800 mb-0.5">Confianza y Penalizaciones</h4>
              <ul class="list-disc pl-3 space-y-0.5 text-slate-600">
                <li>RN-14. Todo usuario posee un porcentaje de confianza entre 0 y 100.</li>
                <li>RN-15. El porcentaje de confianza determina uno de cuatro niveles de confianza.</li>
                <li>RN-16. Las condiciones y restricciones de préstamo pueden variar según el nivel de confianza.</li>
                <li>RN-17. Cada regla puede reducir la confianza del usuario en un porcentaje configurable según su gravedad.</li>
                <li>RN-18. Los porcentajes de penalización no deben estar definidos como constantes fijas del sistema.</li>
                <li>RN-19. Los cambios en una regla no modifican retroactively el porcentaje de incumplimientos anteriores.</li>
                <li>RN-20. Las reglas y términos deben poder modificarse dinámicamente por administradores.</li>
              </ul>
            </div>

            <div>
              <h4 class="font-bold text-slate-800 mb-0.5">Catálogo y Ejemplares</h4>
              <ul class="list-disc pl-3 space-y-0.5 text-slate-600">
                <li>RN-21. Un recurso representa el elemento general del catálogo y un ejemplar representa una copia física concreta.</li>
                <li>RN-22. El préstamo se realiza sobre un ejemplar concreto y no sobre el recurso general.</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <input type="checkbox" v-model="registerChecked" :disabled="!canCheckRegister" class="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer disabled:opacity-50">
          <label class="text-[10px] text-slate-600 select-none">
            He leído y acepto todas las reglas de negocio.
          </label>
        </div>

        <button
          :disabled="!(canCheckRegister && registerChecked)"
          class="w-full py-2 text-white rounded-xl text-xs font-semibold transition"
          :class="(canCheckRegister && registerChecked) ? 'bg-[#1e3a5f] hover:bg-[#152a45] cursor-pointer' : 'bg-slate-400 cursor-not-allowed opacity-60'"
        >
          Registrarse
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

<script>
export default {
  name: 'App',
  data() {
    return {
      view: 'main',            // 'main' | 'google' | 'register'
      passwordVisible: false,
      emailInput: 'estudiante@unsa.edu.pe',
      password: '1234',
      loggingIn: false,

      // Vista Google
      googleEmailLocal: '',
      googleError: null,

      // Cuentas registradas en el sistema (demo)
      registeredEmails: [
        'estudiante@unsa.edu.pe',
        'operador@unsa.edu.pe',
        'admin@unsa.edu.pe',
        'cherrera@unsa.edu.pe'
      ],

      // Registro vista register
      passwordVisibleRegister: false,
      registerPassword: '',
      canCheckRegister: false,
      registerChecked: false
    }
  },
  methods: {
    handleLogin() {
      if (!this.emailInput || !this.emailInput.endsWith('@unsa.edu.pe')) {
        alert('Acceso denegado: Solo se permiten correos institucionales con el dominio @unsa.edu.pe')
        return
      }

      this.loggingIn = true
      setTimeout(() => {
        this.loggingIn = false
        alert('¡Inicio de sesión exitoso con ' + this.emailInput + '!')
      }, 600)
    },
    showMainView() {
      this.view = 'main'
      this.loggingIn = false
    },
    showGoogleView() {
      this.view = 'google'
      this.googleEmailLocal = ''
      this.googleError = null
    },
    onGoogleEmailInput() {
      this.googleError = null
      this.googleEmailLocal = this.stripGoogleDomain(this.googleEmailLocal)
    },
    stripGoogleDomain(value) {
      const domain = '@unsa.edu.pe'
      if (value.toLowerCase().endsWith(domain)) {
        return value.slice(0, value.length - domain.length)
      }
      return value
    },
    handleGoogleContinue() {
      // Por si el dominio llegó sin pasar por el evento @input (ej. autocompletado)
      const local = this.stripGoogleDomain(this.googleEmailLocal.trim())

      // Validación de formato: debe existir texto y no contener espacios ni "@" restantes
      if (!local || /[\s@]/.test(local)) {
        this.googleError = 'Solo se permiten correos institucionales @unsa.edu.pe'
        return
      }

      const fullEmail = local.toLowerCase() + '@unsa.edu.pe'

      // Validación contra las cuentas existentes en el sistema
      if (!this.registeredEmails.includes(fullEmail)) {
        this.googleError = 'Este correo no está registrado en el sistema.'
        return
      }

      this.googleError = null
      alert('¡Inicio de sesión exitoso con Google usando ' + fullEmail + '!')
    },
    showRegisterView() {
      this.view = 'register'
      this.canCheckRegister = false
      this.registerChecked = false
      this.$nextTick(() => {
        if (this.$refs.registerScroll) this.$refs.registerScroll.scrollTop = 0
      })
    },
    checkRegisterScroll() {
      const el = this.$refs.registerScroll
      if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
        this.canCheckRegister = true
      }
    }
  }
}
</script>

<style>
</style>