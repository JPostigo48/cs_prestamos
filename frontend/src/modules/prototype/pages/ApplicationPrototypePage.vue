<template>
  <!-- Marco Estilo Móvil (Se oculta en PC solo si ya inició sesión) -->
  <div 
    class="w-full max-w-sm h-[680px] bg-white rounded-[32px] shadow-lg overflow-hidden border border-slate-200 flex flex-col relative mx-auto mt-6" 
    :class="{ 'lg:hidden': showDesktopPage }"
  >

    <LoginForm
      v-if="view === 'main'"
      v-model:email="emailInput"
      v-model:password="password"
      prototype
      :loading="loggingIn"
      @submit="handleLogin"
      @google="showGoogleView"
      @register="showRegisterView"
    />

    <div v-if="view === 'google'" class="flex flex-col h-full overflow-hidden">
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

    <!-- ================= VISTA 3: REGISTRO ================= -->
    <div v-if="view === 'register'" class="flex flex-col h-full bg-white overflow-hidden">
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

        <div class="border border-slate-200 rounded-xl flex flex-col flex-grow overflow-hidden bg-slate-50">
          <div class="bg-slate-100 px-3 py-1.5 border-b border-slate-200 shrink-0">
            <h3 class="font-bold text-slate-800 text-[11px]">Reglas de Negocio</h3>
          </div>
          <div ref="registerScroll" @scroll="checkRegisterScroll" class="p-2.5 overflow-y-auto text-[10px] text-slate-700 space-y-2.5">
            <p class="text-slate-600">Desplácese hasta el final para habilitar la casilla de aceptación de términos y condiciones de la EPCC.</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <input type="checkbox" v-model="registerChecked" :disabled="!canCheckRegister" class="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer disabled:opacity-50">
          <label class="text-[10px] text-slate-600 select-none">He leído y acepto todas las reglas de negocio.</label>
        </div>

        <button :disabled="!(canCheckRegister && registerChecked)" class="w-full py-2 text-white rounded-xl text-xs font-semibold transition bg-[#1e3a5f] hover:bg-[#152a45] cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed">
          Registrarse
        </button>

        <div class="text-center">
          <a href="#" @click.prevent="showMainView" class="text-blue-600 text-xs font-medium hover:underline">¿Ya tienes cuenta? Inicia sesión</a>
        </div>
      </div>
      <footer class="text-center py-2 bg-white border-t border-slate-100 text-[9px] text-slate-400 shrink-0 leading-tight px-4">
        <p>CS Préstamos · Escuela de Ciencias de la Computación</p>
      </footer>
    </div>

    <!-- ================= VISTA 4: DASHBOARD DEL ESTUDIANTE ================= -->
    <div v-if="view === 'student-home'" class="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div class="pt-5 px-6 pb-3 bg-white border-b border-slate-100 shrink-0">
        <p class="text-xs text-slate-500">Bienvenido/a,</p>
        <h2 class="text-lg font-extrabold text-slate-900 tracking-tight">{{ currentUser?.name }}</h2>
        <div class="flex items-center gap-2 mt-2">
          <span
            v-if="isSuspended"
            class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200"
          >
            ● Cuenta suspendida
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
          >
            ● Cuenta habilitada
          </span>
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            ★ Nivel: {{ studentLevel }}
          </span>
        </div>
      </div>

      <div class="p-4 flex-grow overflow-y-auto space-y-4">
        <div v-if="toast" class="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-[11px] font-medium">
          {{ toast }}
        </div>

        <!-- Aviso de cuenta suspendida -->
        <div v-if="isSuspended" class="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
          <template v-if="activeSanction">
            <div class="flex items-start gap-2">
              <span class="text-base">⚠️</span>
              <div>
                <h3 class="text-sm font-bold text-red-700">Sanción activa ({{ activeSanction.level.toLowerCase() }})</h3>
                <p class="text-xs text-red-600 mt-0.5 leading-relaxed">
                  Motivo: {{ activeSanction.reason }}. Vigente hasta {{ activeSanction.until }}.
                </p>
              </div>
            </div>

            <button
              v-if="!myAppeal"
              @click="openAppealModal"
              class="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              Apelar sanción
            </button>
            <p v-else-if="myAppeal.status === 'PENDIENTE'" class="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              ⏳ Tu apelación está en revisión por un administrador.
            </p>
            <p v-else class="text-[11px] text-red-700 bg-white border border-red-200 rounded-xl px-3 py-2">
              Tu apelación fue rechazada. La sanción se mantiene.
            </p>
          </template>
        </div>

        <!-- Explorar Catálogo -->
        <div>
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Explorar catálogo</h3>
            <span @click="scrollToCategory('all')" class="text-xs text-blue-600 font-medium cursor-pointer hover:underline">Ver todo ›</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div @click="scrollToCategory('electricos')" class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 cursor-pointer transition">
              <div class="text-blue-600 text-base mb-1">💻</div>
              <h4 class="text-[11px] font-bold text-slate-800 leading-tight">Electrónicos</h4>
              <p class="text-[9px] text-emerald-600 font-medium mt-1">{{ availableByCategory.electricos }} disp.</p>
            </div>
            <div @click="scrollToCategory('libros')" class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 cursor-pointer transition">
              <div class="text-purple-600 text-base mb-1">📖</div>
              <h4 class="text-[11px] font-bold text-slate-800 leading-tight">Libros</h4>
              <p class="text-[9px] text-emerald-600 font-medium mt-1">{{ availableByCategory.libros }} disp.</p>
            </div>
            <div @click="scrollToCategory('deportes')" class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 cursor-pointer transition">
              <div class="text-emerald-600 text-base mb-1">⚽</div>
              <h4 class="text-[11px] font-bold text-slate-800 leading-tight">Deportes</h4>
              <p class="text-[9px] text-emerald-600 font-medium mt-1">{{ availableByCategory.deportes }} disp.</p>
            </div>
          </div>
        </div>

        <!-- Mis Préstamos Activos -->
        <div>
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Mis Préstamos Activos</h3>
            <span class="text-[10px] text-slate-500 font-medium">{{ myActiveLoans.length }} activos</span>
          </div>

          <div v-for="(loan, idx) in myActiveLoans" :key="idx" class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-2">
            <div class="flex justify-between items-start">
              <div>
                <h4 class="text-xs font-bold text-slate-900">{{ loan.item }}</h4>
                <p class="text-[10px] text-slate-500">{{ loan.code }} · {{ loan.category }}</p>
              </div>
              <span
                class="px-2 py-0.5 rounded-full text-[9px] font-medium border"
                :class="isOverdue(loan) ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'"
              >
                ● {{ isOverdue(loan) ? 'En mora' : 'En préstamo' }}
              </span>
            </div>
          </div>

          <div v-if="myActiveLoans.length === 0" class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <p class="text-[11px] text-slate-400">No tienes préstamos activos.</p>
          </div>
        </div>
      </div>

      <nav class="bg-white border-t border-slate-200 py-2 px-6 flex justify-around items-center shrink-0">
        <button @click="view = 'student-home'" class="flex flex-col items-center text-blue-600 cursor-pointer">
          <span class="text-lg">🏠</span>
          <span class="text-[9px] font-semibold">Inicio</span>
        </button>
        <button @click="scrollToCategory('all')" class="flex flex-col items-center text-slate-400 hover:text-slate-600 cursor-pointer">
          <span class="text-lg">🗂️</span>
          <span class="text-[9px] font-semibold">Catálogo</span>
        </button>
        <button @click="showMainView" class="flex flex-col items-center text-red-500 hover:text-red-700 cursor-pointer">
          <span class="text-lg">🚪</span>
          <span class="text-[9px] font-semibold">Salir</span>
        </button>
      </nav>
    </div>

    <!-- ================= VISTA 5: CATÁLOGO UNIFICADO ================= -->
    <div v-if="view === 'catalog'" class="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div class="pt-4 px-4 pb-3 bg-white border-b border-slate-100 shrink-0">
        <h2 class="text-sm font-extrabold text-slate-900">Catálogo de Artículos</h2>
        <p class="text-[10px] text-slate-500 mb-2">{{ filteredItems.length }} artículos encontrados</p>

        <div class="flex gap-2">
          <input type="text" v-model="searchQuery" placeholder="Buscar artículo..." class="flex-grow px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-blue-500">
          <label class="flex items-center gap-1 text-[10px] text-slate-600 whitespace-nowrap cursor-pointer">
            <input type="checkbox" v-model="onlyAvailable" class="rounded border-slate-300"> Solo disp.
          </label>
        </div>
      </div>

      <div ref="catalogContainer" class="p-3 flex-grow overflow-y-auto space-y-4">
        <!-- Electrónicos -->
        <div id="section-electricos" class="space-y-2" v-if="electricosItems.length > 0">
          <div class="bg-blue-50/70 border border-blue-100 p-2 rounded-xl flex justify-between items-center">
            <h3 class="text-xs font-bold text-blue-900 flex items-center gap-1">💻 Electrónicos</h3>
            <span class="text-[10px] text-blue-700 font-semibold">{{ electricosItems.length }} artículos</span>
          </div>

          <div v-for="item in electricosItems" :key="item.code" class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div class="flex justify-between items-start">
              <span class="text-[10px] font-bold" :class="item.availableCount > 0 ? 'text-emerald-600' : 'text-red-500'">
                {{ item.stockText }}
              </span>
              <span class="text-[9px] text-slate-400">{{ item.code }}</span>
            </div>
            <div>
              <h4 class="text-xs font-bold text-slate-900">{{ item.name }}</h4>
              <p class="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{{ item.description }}</p>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-slate-100 text-[10px] text-slate-500">
              <span>🕒 {{ item.maxTime }}</span>
              <span @click="openItemDetail(item)" class="text-blue-600 font-medium cursor-pointer hover:underline">Historial →</span>
            </div>
          </div>
        </div>

        <!-- Libros -->
        <div id="section-libros" class="space-y-2" v-if="librosItems.length > 0">
          <div class="bg-purple-50/70 border border-purple-100 p-2 rounded-xl flex justify-between items-center">
            <h3 class="text-xs font-bold text-purple-900 flex items-center gap-1">📖 Libros</h3>
            <span class="text-[10px] text-purple-700 font-semibold">{{ librosItems.length }} artículos</span>
          </div>

          <div v-for="item in librosItems" :key="item.code" class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div class="flex justify-between items-start">
              <span class="text-[10px] font-bold" :class="item.availableCount > 0 ? 'text-emerald-600' : 'text-red-500'">
                {{ item.stockText }}
              </span>
              <span class="text-[9px] text-slate-400">{{ item.code }}</span>
            </div>
            <div>
              <h4 class="text-xs font-bold text-slate-900">{{ item.name }}</h4>
              <p class="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{{ item.description }}</p>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-slate-100 text-[10px] text-slate-500">
              <span>🕒 {{ item.maxTime }}</span>
              <span @click="openItemDetail(item)" class="text-blue-600 font-medium cursor-pointer hover:underline">Historial →</span>
            </div>
          </div>
        </div>

        <!-- Deportes -->
        <div id="section-deportes" class="space-y-2" v-if="deportesItems.length > 0">
          <div class="bg-emerald-50/70 border border-emerald-100 p-2 rounded-xl flex justify-between items-center">
            <h3 class="text-xs font-bold text-emerald-900 flex items-center gap-1">⚽ Deportes</h3>
            <span class="text-[10px] text-emerald-700 font-semibold">{{ deportesItems.length }} artículos</span>
          </div>

          <div v-for="item in deportesItems" :key="item.code" class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div class="flex justify-between items-start">
              <span class="text-[10px] font-bold" :class="item.availableCount > 0 ? 'text-emerald-600' : 'text-red-500'">
                {{ item.stockText }}
              </span>
              <span class="text-[9px] text-slate-400">{{ item.code }}</span>
            </div>
            <div>
              <h4 class="text-xs font-bold text-slate-900">{{ item.name }}</h4>
              <p class="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{{ item.description }}</p>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-slate-100 text-[10px] text-slate-500">
              <span>🕒 {{ item.maxTime }}</span>
              <span @click="openItemDetail(item)" class="text-blue-600 font-medium cursor-pointer hover:underline">Historial →</span>
            </div>
          </div>
        </div>

        <div v-if="filteredItems.length === 0" class="text-center py-10">
          <p class="text-xs text-slate-400">No se encontraron artículos con los filtros aplicados.</p>
        </div>
      </div>

      <!-- Barra Inferior -->
      <nav class="bg-white border-t border-slate-200 py-2 px-6 flex justify-around items-center shrink-0">
        <button v-if="isAdmin" @click="view = 'admin-appeals'" class="flex flex-col items-center text-slate-400 hover:text-slate-600 cursor-pointer">
          <span class="text-lg">⚖️</span>
          <span class="text-[9px] font-semibold">Admin</span>
        </button>
        <button v-else @click="goHome" class="flex flex-col items-center text-slate-400 hover:text-slate-600 cursor-pointer">
          <span class="text-lg">{{ isOperator ? '📦' : '🏠' }}</span>
          <span class="text-[9px] font-semibold">{{ isOperator ? 'Operador' : 'Inicio' }}</span>
        </button>
        <button @click="scrollToCategory('all')" class="flex flex-col items-center text-blue-600 cursor-pointer">
          <span class="text-lg">🗂️</span>
          <span class="text-[9px] font-semibold">Catálogo</span>
        </button>
        <button @click="showMainView" class="flex flex-col items-center text-red-500 hover:text-red-700 cursor-pointer">
          <span class="text-lg">🚪</span>
          <span class="text-[9px] font-semibold">Salir</span>
        </button>
      </nav>
    </div>

    <!-- ================= VISTA 6: DETALLE DE ARTÍCULO ================= -->
    <div v-if="view === 'item-detail'" class="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div class="pt-4 px-4 pb-3 bg-white border-b border-slate-100 shrink-0">
        <button @click="view = 'catalog'" class="text-xs text-blue-600 font-medium flex items-center gap-1 mb-2 hover:underline cursor-pointer">
          ‹ Volver al catálogo
        </button>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{{ selectedItem?.categoryName }}</p>
        <h2 class="text-base font-extrabold text-slate-900">{{ selectedItem?.name }}</h2>
        <p class="text-[10px] text-slate-500">Código: {{ selectedItem?.code }}</p>
      </div>

      <div class="p-3.5 flex-grow overflow-y-auto space-y-3">
        <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <h3 class="text-xs font-bold text-slate-900">Descripción</h3>
          <p class="text-[10px] text-slate-600 leading-relaxed">{{ selectedItem?.description }}</p>
        </div>

        <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <h3 class="text-xs font-bold text-slate-900">Partes y Accesorios</h3>
          <div class="space-y-1.5">
            <div v-for="(part, idx) in selectedItem?.parts" :key="idx" class="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-700 flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              <span>{{ part }}</span>
            </div>
          </div>
        </div>

        <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <h3 class="text-xs font-bold text-slate-900">Disponibilidad</h3>
          <div class="flex items-baseline gap-2">
            <span class="text-xl font-extrabold" :class="selectedItem && selectedItem.availableCount > 0 ? 'text-emerald-600' : 'text-red-500'">
              {{ selectedItem && selectedItem.availableCount > 0 ? selectedItem.availableCount : 0 }}
            </span>
            <span class="text-[10px] text-slate-400 ml-auto">de {{ selectedItem?.totalCount }} en total</span>
          </div>
          <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300" :class="selectedItem && selectedItem.availableCount > 0 ? 'bg-emerald-500' : 'bg-red-500'" :style="{ width: selectedItem ? (selectedItem.availableCount / selectedItem.totalCount) * 100 + '%' : '0%' }"></div>
          </div>
          <button
            v-if="!isOperator && !isAdmin"
            :disabled="!canReserve"
            class="w-full py-2 rounded-xl text-xs font-bold transition mt-2 cursor-pointer"
            :class="canReserve ? 'bg-[#1e3a5f] text-white shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'"
          >
            {{ isSuspended ? 'Cuenta suspendida' : (canReserve ? 'Reservar equipo' : 'Sin disponibilidad') }}
          </button>
        </div>
      </div>
      
      <nav class="bg-white border-t border-slate-200 py-2 px-6 flex justify-around items-center shrink-0">
        <button v-if="isAdmin" @click="view = 'admin-appeals'" class="flex flex-col items-center text-slate-400 hover:text-slate-600 cursor-pointer">
          <span class="text-lg">⚖️</span>
          <span class="text-[9px] font-semibold">Admin</span>
        </button>
        <button v-else @click="goHome" class="flex flex-col items-center text-slate-400 hover:text-slate-600 cursor-pointer">
          <span class="text-lg">{{ isOperator ? '📦' : '🏠' }}</span>
          <span class="text-[9px] font-semibold">{{ isOperator ? 'Operador' : 'Inicio' }}</span>
        </button>
        <button @click="scrollToCategory('all')" class="flex flex-col items-center text-blue-600 cursor-pointer">
          <span class="text-lg">🗂️</span>
          <span class="text-[9px] font-semibold">Catálogo</span>
        </button>
        <button @click="showMainView" class="flex flex-col items-center text-red-500 hover:text-red-700 cursor-pointer">
          <span class="text-lg">🚪</span>
          <span class="text-[9px] font-semibold">Salir</span>
        </button>
      </nav>
    </div>

    <!-- ================= VISTA 7: OPERADOR ================= -->
    <div v-if="view === 'operator-home'" class="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div class="pt-6 px-5 pb-3 bg-white shrink-0">
        <h2 class="text-lg font-extrabold text-slate-900 tracking-tight">Gestión de Cierres</h2>
        <p class="text-xs text-slate-500">Revisa checklist y recibe los equipos</p>
      </div>

      <div class="px-5 pb-3 bg-white border-b border-slate-100 flex gap-2 shrink-0">
        <button
          @click="operatorTab = 'active'"
          class="px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer"
          :class="operatorTab === 'active' ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-slate-600 border-slate-200'"
        >
          Activos ({{ operatorLoans.length }})
        </button>
        <button
          @click="operatorTab = 'overdue'"
          class="px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer"
          :class="operatorTab === 'overdue' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-600 border-slate-200'"
        >
          Mora ({{ overdueLoans.length }})
        </button>
      </div>

      <div class="p-4 flex-grow overflow-y-auto space-y-3">
        <div v-if="toast" class="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-[11px] font-medium">
          {{ toast }}
        </div>
        
        <div
          v-for="loan in visibleOperatorLoans"
          :key="loan.id"
          class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2"
        >
          <h4 class="text-sm font-bold text-slate-900">{{ loan.borrower }}</h4>
          <p class="text-[11px] text-slate-500">
            {{ loan.itemName }} 
            <span :class="loan.overdue ? 'text-red-600 font-bold' : ''">Límite: {{ loan.dueDate }}</span>
          </p>
          <button
            @click="openChecklist(loan)"
            class="w-full py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 cursor-pointer"
          >
            ✓ Recibir
          </button>
        </div>

        <div v-if="visibleOperatorLoans.length === 0" class="text-center py-10">
          <p class="text-xs text-slate-400">Sin registros en esta pestaña.</p>
        </div>
      </div>

      <nav v-if="isAdmin" class="bg-white border-t border-slate-200 py-2 px-6 flex justify-around items-center shrink-0">
        <button @click="view = 'admin-appeals'" class="flex flex-col items-center text-slate-400"><span class="text-lg">⚖️</span><span class="text-[9px] font-semibold">Apelaciones</span></button>
        <button @click="view = 'admin-users'" class="flex flex-col items-center text-slate-400"><span class="text-lg">👥</span><span class="text-[9px] font-semibold">Usuarios</span></button>
        <button @click="view = 'operator-home'" class="flex flex-col items-center text-[#1e3a5f]"><span class="text-lg">📦</span><span class="text-[9px] font-semibold">Operador</span></button>
        <button @click="showMainView" class="flex flex-col items-center text-red-500"><span class="text-lg">🚪</span><span class="text-[9px] font-semibold">Salir</span></button>
      </nav>
      <nav v-else class="bg-white border-t border-slate-200 py-2 px-6 flex justify-around items-center shrink-0">
        <button @click="view = 'operator-home'" class="flex flex-col items-center text-[#1e3a5f]"><span class="text-lg">📦</span><span class="text-[9px] font-semibold">Panel</span></button>
        <button @click="scrollToCategory('all')" class="flex flex-col items-center text-slate-400"><span class="text-lg">🗂️</span><span class="text-[9px] font-semibold">Catálogo</span></button>
        <button @click="showMainView" class="flex flex-col items-center text-red-500"><span class="text-lg">🚪</span><span class="text-[9px] font-semibold">Salir</span></button>
      </nav>
    </div>

    <!-- ================= VISTA 8: ADMIN APELACIONES ================= -->
    <div v-if="view === 'admin-appeals'" class="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div class="pt-6 px-5 pb-3 bg-white border-b border-slate-100 shrink-0">
        <h2 class="text-lg font-extrabold text-slate-900 tracking-tight">Apelaciones Recibidas</h2>
        <p class="text-xs text-slate-500">{{ pendingAppealsCount }} pendiente(s) de revisión</p>
      </div>

      <div class="p-4 flex-grow overflow-y-auto space-y-3">
        <div v-if="toast" class="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-[11px] font-medium">{{ toast }}</div>
        
        <div v-for="appeal in sortedAppeals" :key="appeal.id" class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="text-sm font-bold text-slate-900">{{ appeal.studentName }}</h4>
              <p class="text-[10px] text-slate-500">{{ appeal.email }}</p>
            </div>
            <span class="px-2 py-0.5 rounded-md text-[9px] font-bold" :class="appeal.status === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100'">
              {{ appeal.status }}
            </span>
          </div>
          
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p class="text-[11px] text-slate-700 italic">"{{ appeal.reason }}"</p>
          </div>

          <div v-if="appeal.status === 'PENDIENTE'" class="flex gap-2">
            <button @click="resolveAppeal(appeal, false)" class="flex-1 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600">Rechazar</button>
            <button @click="resolveAppeal(appeal, true)" class="flex-1 py-2 rounded-xl text-xs font-bold bg-[#1e3a5f] text-white">Aprobar</button>
          </div>
        </div>
      </div>

      <nav class="bg-white border-t border-slate-200 py-2 px-6 flex justify-around items-center shrink-0">
        <button @click="view = 'admin-appeals'" class="flex flex-col items-center text-[#1e3a5f]"><span class="text-lg">⚖️</span><span class="text-[9px] font-semibold">Apelaciones</span></button>
        <button @click="view = 'admin-users'" class="flex flex-col items-center text-slate-400"><span class="text-lg">👥</span><span class="text-[9px] font-semibold">Usuarios</span></button>
        <button @click="view = 'admin-catalog'" class="flex flex-col items-center text-slate-400"><span class="text-lg">🗂️</span><span class="text-[9px] font-semibold">Catálogo</span></button>
        <button @click="view = 'operator-home'" class="flex flex-col items-center text-slate-400"><span class="text-lg">📦</span><span class="text-[9px] font-semibold">Operador</span></button>
      </nav>
    </div>

    <!-- ================= VISTA 9: ADMIN USUARIOS ================= -->
    <div v-if="view === 'admin-users'" class="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div class="pt-6 px-5 pb-3 bg-white border-b border-slate-100 shrink-0">
        <h2 class="text-base font-extrabold text-slate-900">Gestión de Usuarios</h2>
        <div class="relative mt-3">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          <input type="text" v-model="userSearch" placeholder="Buscar usuario..." class="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs">
        </div>
      </div>

      <div class="p-4 flex-grow overflow-y-auto space-y-3">
        <div v-if="toast" class="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-[11px] font-medium">{{ toast }}</div>
        
        <div v-for="user in filteredUsers" :key="user.id" class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="text-sm font-bold text-slate-900">{{ user.name }}</h4>
              <p class="text-[10px] text-slate-500">{{ user.email }}</p>
            </div>
            <span @click="openUserHistory(user)" class="text-[11px] text-blue-500 cursor-pointer">Historial</span>
          </div>

          <div class="flex justify-between items-center">
            <span class="px-2 py-0.5 rounded-md text-[9px] font-bold" :class="user.suspended ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'">
              {{ user.suspended ? 'SUSPENDIDO' : 'ACTIVO' }}
            </span>
            <select v-if="user.role !== 'Admin'" v-model="user.role" @change="onRoleChange(user)" class="px-2 py-1 text-xs border rounded-lg">
              <option value="Estudiante">Estudiante</option>
              <option value="Operador">Operador</option>
            </select>
          </div>

          <button v-if="user.role !== 'Admin'" @click="toggleSuspension(user)" class="w-full py-2 rounded-xl text-xs font-bold border" :class="user.suspended ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'">
            {{ user.suspended ? 'Levantar' : 'Suspender' }}
          </button>
        </div>
      </div>

      <nav class="bg-white border-t border-slate-200 py-2 px-6 flex justify-around items-center shrink-0">
        <button @click="view = 'admin-appeals'" class="flex flex-col items-center text-slate-400"><span class="text-lg">⚖️</span><span class="text-[9px] font-semibold">Apelaciones</span></button>
        <button @click="view = 'admin-users'" class="flex flex-col items-center text-[#1e3a5f]"><span class="text-lg">👥</span><span class="text-[9px] font-semibold">Usuarios</span></button>
        <button @click="view = 'admin-catalog'" class="flex flex-col items-center text-slate-400"><span class="text-lg">🗂️</span><span class="text-[9px] font-semibold">Catálogo</span></button>
        <button @click="view = 'operator-home'" class="flex flex-col items-center text-slate-400"><span class="text-lg">📦</span><span class="text-[9px] font-semibold">Operador</span></button>
      </nav>
    </div>

    <!-- ================= VISTA 10: ADMIN CATÁLOGO ================= -->
    <div v-if="view === 'admin-catalog'" class="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div class="pt-6 px-5 pb-3 bg-white border-b border-slate-100 shrink-0">
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-base font-extrabold text-slate-900">Gestión de Catálogo</h2>
          <button @click="openAddProduct" class="bg-[#1e3a5f] text-white px-3 py-1.5 rounded-lg text-xs font-bold">+</button>
        </div>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          <input type="text" v-model="searchQuery" placeholder="Buscar artículo..." class="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs">
        </div>
      </div>

      <div class="p-4 flex-grow overflow-y-auto space-y-3">
        <div v-if="toast" class="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-[11px] font-medium">{{ toast }}</div>
        
        <div v-for="item in filteredItems" :key="item.code" class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div class="flex justify-between items-start">
            <div>
              <span class="px-2 py-0.5 bg-slate-100 text-[9px] rounded font-bold uppercase">{{ item.categoryName }}</span>
              <h4 class="text-sm font-bold text-slate-900 mt-1">{{ item.name }}</h4>
              <p class="text-[10px] text-slate-500">{{ item.code }}</p>
            </div>
            <span class="text-xs font-bold" :class="item.availableCount > 0 ? 'text-emerald-600' : 'text-red-500'">
              {{ item.availableCount }}/{{ item.totalCount }}
            </span>
          </div>
          <button @click="openEditProduct(item)" class="w-full py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold mt-2">
            Editar Artículo
          </button>
        </div>
      </div>

      <nav class="bg-white border-t border-slate-200 py-2 px-6 flex justify-around items-center shrink-0">
        <button @click="view = 'admin-appeals'" class="flex flex-col items-center text-slate-400"><span class="text-lg">⚖️</span><span class="text-[9px] font-semibold">Apelaciones</span></button>
        <button @click="view = 'admin-users'" class="flex flex-col items-center text-slate-400"><span class="text-lg">👥</span><span class="text-[9px] font-semibold">Usuarios</span></button>
        <button @click="view = 'admin-catalog'" class="flex flex-col items-center text-[#1e3a5f]"><span class="text-lg">🗂️</span><span class="text-[9px] font-semibold">Catálogo</span></button>
        <button @click="view = 'operator-home'" class="flex flex-col items-center text-slate-400"><span class="text-lg">📦</span><span class="text-[9px] font-semibold">Operador</span></button>
      </nav>
    </div>

    <!-- ================= MODALES DEL MÓVIL ================= -->
    <div v-if="historyUser" class="absolute inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div class="w-full bg-white rounded-2xl shadow-xl flex flex-col max-h-full">
        <div class="px-5 py-4 border-b flex justify-between">
          <h3 class="text-sm font-bold">Historial de Usuario</h3>
          <button @click="closeUserHistory">✕</button>
        </div>
        <div class="p-4 overflow-y-auto space-y-3">
          <div v-for="loan in historyUser.loans" :key="loan.item" class="p-3 bg-slate-50 border-l-4 border-blue-400 rounded">
            <p class="text-xs font-bold">{{ loan.item }}</p>
            <p class="text-[10px] text-slate-500">{{ loan.date }} · {{ loan.status }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showAppealModal" class="absolute inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div class="w-full bg-white rounded-2xl shadow-xl p-5 space-y-3">
        <h3 class="text-sm font-extrabold text-slate-900">Formular Apelación</h3>
        <textarea v-model="appealText" rows="4" placeholder="Justificación..." class="w-full px-3 py-2 border rounded-xl text-xs resize-none"></textarea>
        <div class="flex gap-2">
          <button @click="closeAppealModal" class="flex-1 py-2 rounded-xl text-xs bg-slate-100">Cancelar</button>
          <button @click="submitAppeal" :disabled="!appealText.trim()" class="flex-1 py-2 rounded-xl text-xs bg-[#1e3a5f] text-white">Enviar</button>
        </div>
      </div>
    </div>

    <div v-if="showReturnModal" class="absolute inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div class="w-full bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <h3 class="text-sm font-bold">Asistente de Devolución</h3>
        <div class="space-y-2">
          <label v-for="part in checklistParts" :key="part" class="flex items-center gap-2 text-xs">
            <input type="checkbox" :value="part" v-model="checkedParts"> {{ part }}
          </label>
        </div>
        <label class="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs" :class="onTime ? 'bg-emerald-50' : 'bg-red-50'">
          <input type="checkbox" v-model="onTime"> En plazo
        </label>
        <div class="flex gap-2">
          <button @click="closeReturnModal" class="flex-1 py-2 rounded-xl text-xs bg-slate-100">Cancelar</button>
          <button @click="confirmReceive" class="flex-1 py-2 rounded-xl text-xs bg-[#1e3a5f] text-white">Confirmar</button>
        </div>
      </div>
    </div>

    <div v-if="showProductModal" class="absolute inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div class="w-full bg-white rounded-2xl shadow-xl p-5 space-y-3 overflow-y-auto max-h-full">
        <h3 class="text-sm font-bold">{{ isEditingProduct ? 'Editar Artículo' : 'Nuevo Artículo' }}</h3>
        <div class="space-y-2 text-xs">
          <input v-model="productForm.code" :disabled="isEditingProduct" placeholder="Código" class="w-full p-2 border rounded">
          <select v-model="productForm.category" class="w-full p-2 border rounded">
            <option value="electricos">Electrónicos</option>
            <option value="libros">Libros</option>
            <option value="deportes">Deportes</option>
          </select>
          <input v-model="productForm.name" placeholder="Nombre" class="w-full p-2 border rounded">
          <textarea v-model="productForm.description" placeholder="Descripción" class="w-full p-2 border rounded"></textarea>
          <div class="flex gap-2">
            <input v-model="productForm.maxTime" placeholder="Tiempo máx." class="w-1/2 p-2 border rounded">
            <input type="number" v-model="productForm.totalCount" placeholder="Total" class="w-1/2 p-2 border rounded">
          </div>
          <textarea v-model="productForm.partsString" placeholder="Partes (separadas por coma)" class="w-full p-2 border rounded"></textarea>
        </div>
        <div class="flex gap-2">
          <button @click="closeProductModal" class="flex-1 py-2 rounded-xl text-xs bg-slate-100">Cancelar</button>
          <button @click="saveProduct" class="flex-1 py-2 rounded-xl text-xs bg-[#1e3a5f] text-white">Guardar</button>
        </div>
      </div>
    </div>
  </div> <!-- Fin Marco Móvil -->

  <!-- ================= COMPONENTE DE ESCRITORIO ================= -->
  <!-- Aquí utilizamos lg:flex y hidden para garantizar que se muestre de forma exclusiva en PC cuando el usuario esté logueado -->
  <StudentDesktopPage
    v-if="showDesktopPage"
    class="hidden lg:flex"
    :view="view"
    :role="role"
    :user="currentUser"
    :suspended="isSuspended"
    :level="studentLevel"
    :active-sanction="activeSanction"
    :appeal="myAppeal"
    :loans="myActiveLoans"
    :items="filteredItems"
    :catalog-items="allCatalogItems"
    :selected-item="selectedItem"
    :selected-category="desktopCategory"
    :available-by-category="availableByCategory"
    :users="users"
    :filtered-users="filteredUsers"
    :operator-loans="operatorLoans"
    :visible-operator-loans="visibleOperatorLoans"
    :appeals="appeals"
    :sorted-appeals="sortedAppeals"
    :pending-appeals-count="pendingAppealsCount"
    :history-user="historyUser"
    :selected-loan="selectedLoan"
    :checklist-parts="checklistParts"
    :current-sanction="currentSanction"
    :toast="toast"
    :appeal-open="showAppealModal"
    :return-modal-open="showReturnModal"
    :history-modal-open="!!historyUser"
    :product-modal-open="showProductModal"
    :is-editing-product="isEditingProduct"
    :product-form="productForm"
    v-model:search="searchQuery"
    v-model:only-available="onlyAvailable"
    v-model:appeal-text="appealText"
    v-model:user-search="userSearch"
    v-model:operator-tab="operatorTab"
    v-model:checked-parts="checkedParts"
    v-model:on-time="onTime"
    @home="view = (isAdmin ? 'admin-appeals' : (isOperator ? 'operator-home' : 'student-home'))"
    @catalog="showDesktopCatalog"
    @select-item="openDesktopItem"
    @logout="showMainView"
    @open-appeal="openAppealModal"
    @close-appeal="closeAppealModal"
    @submit-appeal="submitAppeal"
    @switch-view="v => view = v"
    @resolve-appeal="resolveAppeal"
    @toggle-suspension="toggleSuspension"
    @change-role="onRoleChange"
    @open-history="openUserHistory"
    @close-history="closeUserHistory"
    @open-checklist="openChecklist"
    @close-return-modal="closeReturnModal"
    @confirm-receive="confirmReceive"
    @open-add-product="openAddProduct"
    @open-edit-product="openEditProduct"
    @close-product-modal="closeProductModal"
    @save-product="saveProduct"
  />
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import StudentDesktopPage from '../components/StudentDesktopPage.vue'
import LoginForm from '../../auth/components/LoginForm.vue'

// --- Tipos e Interfaces ---
type ViewType =
  | 'main' | 'google' | 'register'
  | 'student-home' | 'catalog' | 'item-detail'
  | 'operator-home' | 'admin-appeals' | 'admin-users' | 'admin-catalog'

type Role = 'student' | 'operator' | 'admin'

interface HistoryRecord { 
  user: string; 
  date: string; 
  status: 'LOANED' | 'RETURNED' 
}

interface CatalogItem { 
  category: 'electricos' | 'libros' | 'deportes'; 
  categoryName: string; 
  code: string; 
  name: string; 
  description: string; 
  stockText: string; 
  availableCount: number; 
  totalCount: number; 
  maxTime: string; 
  parts: string[]; 
  history: HistoryRecord[] 
}

interface OperatorLoan { 
  id: number; 
  borrower: string; 
  itemName: string; 
  itemCode: string; 
  dueDate: string; 
  overdue: boolean 
}

interface LoanRecord { 
  item: string; 
  code?: string; 
  category?: string; 
  date: string; 
  daysLeft?: number; 
  status: 'LOANED' | 'RETURNED' 
}

interface SanctionRecord { 
  id: number; 
  rule: string; 
  reason: string; 
  item: string; 
  itemCode: string; 
  level: string; 
  days: number; 
  date: string; 
  until: string 
}

interface AppUser { 
  id: number; 
  name: string; 
  email: string; 
  phone: string; 
  role: 'Estudiante' | 'Operador' | 'Admin'; 
  suspended: boolean; 
  loans: LoanRecord[]; 
  sanctions: SanctionRecord[] 
}

interface Appeal { 
  id: number; 
  userId: number; 
  sanctionId: number; 
  studentName: string; 
  email: string; 
  itemName: string; 
  itemCode: string; 
  sanctionLevel: string; 
  sanctionDays: number; 
  date: string; 
  reason: string; 
  status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' 
}

// --- Estado General de la App ---
const view = ref<ViewType>('main')
const role = ref<Role>('student')
type DesktopCategory = 'all' | CatalogItem['category']
const desktopCategory = ref<DesktopCategory>('all')

// Lógica crucial: Solo mostramos la versión Desktop (PC) si el usuario ya inició sesión
const isLoggedIn = computed(() => !['main', 'google', 'register'].includes(view.value))
const showDesktopPage = computed(() => isLoggedIn.value)

const showDesktopCatalog = (category: DesktopCategory): void => { 
  desktopCategory.value = category; 
  view.value = 'catalog' 
}

const openDesktopItem = (code: string): void => { 
  const item = allCatalogItems.value.find(c => c.code === code); 
  if (item) {
    openItemDetail(item)
  }
}

// --- Variables para Login / Auth ---
const emailInput = ref<string>('estudiante@unsa.edu.pe')
const password = ref<string>('1234')
const loggingIn = ref<boolean>(false)
const googleEmailLocal = ref<string>('')
const googleError = ref<string | null>(null)
const registeredEmails = ref<string[]>([
  'estudiante@unsa.edu.pe', 
  'operador@unsa.edu.pe', 
  'admin@unsa.edu.pe', 
  'cherrera@unsa.edu.pe', 
  'lmendez@unsa.edu.pe'
])
const passwordVisibleRegister = ref<boolean>(false)
const registerPassword = ref<string>('')
const canCheckRegister = ref<boolean>(false)
const registerChecked = ref<boolean>(false)
const registerScroll = ref<HTMLElement | null>(null)

// --- Estados para Vistas Internas Compartidas ---
const searchQuery = ref<string>('')
const userSearch = ref<string>('')
const onlyAvailable = ref<boolean>(false)
const catalogContainer = ref<HTMLElement | null>(null)
const selectedItem = ref<CatalogItem | null>(null)
const toast = ref<string>('')

// --- Estado para el Admin Catálogo (Modales de Producto) ---
const showProductModal = ref(false)
const isEditingProduct = ref(false)
const productForm = ref({ 
  category: 'electricos', 
  code: '', 
  name: '', 
  description: '', 
  totalCount: 1, 
  maxTime: 'Máx. 7 días', 
  partsString: '' 
})

// --- Estado para Operador (Cierres y Checklist) ---
const operatorTab = ref<'active' | 'overdue'>('active')
const selectedLoan = ref<OperatorLoan | null>(null)
const checkedParts = ref<string[]>([])
const showReturnModal = ref<boolean>(false)
const onTime = ref<boolean>(true)

const categoryLabels: Record<CatalogItem['category'], string> = { 
  electricos: 'Electrónico', 
  libros: 'Libro', 
  deportes: 'Deporte' 
}

const sanctionRules: Record<CatalogItem['category'], { level: string; days: number }> = { 
  electricos: { level: 'GRAVE', days: 30 }, 
  libros: { level: 'MODERADA', days: 15 }, 
  deportes: { level: 'LEVE', days: 7 } 
}

const operatorLoans = ref<OperatorLoan[]>([
  { id: 1, borrower: 'Mauricio Farfán', itemName: 'Laptop Dell XPS 13', itemCode: 'EL-2041', dueDate: '2026-09-25', overdue: false },
  { id: 2, borrower: 'Prof. Sandra Gómez', itemName: 'Algoritmos — Cormen', itemCode: 'LB-0441', dueDate: '2026-10-05', overdue: false },
  { id: 3, borrower: 'Carlos Herrera', itemName: 'Kit de Fútbol', itemCode: 'DP-0071', dueDate: '2026-09-20', overdue: true }
])

const overdueLoans = computed(() => operatorLoans.value.filter(l => l.overdue))
const visibleOperatorLoans = computed(() => operatorTab.value === 'overdue' ? overdueLoans.value : operatorLoans.value)

const checklistParts = computed<string[]>(() => {
  if (!selectedLoan.value) return []
  const found = allCatalogItems.value.find(i => i.code === selectedLoan.value!.itemCode)
  return found ? found.parts : []
})

const loanCategory = computed<CatalogItem['category']>(() => { 
  const found = allCatalogItems.value.find(i => i.code === selectedLoan.value?.itemCode); 
  return found ? found.category : 'electricos' 
})

const loanCategoryLabel = computed(() => categoryLabels[loanCategory.value])
const currentSanction = computed(() => sanctionRules[loanCategory.value])

const isOperator = computed(() => role.value === 'operator')
const isAdmin = computed(() => role.value === 'admin')

// --- Bases de Datos Similadas (Usuarios, Apelaciones) ---
const historyUser = ref<AppUser | null>(null)

const users = ref<AppUser[]>([
  { 
    id: 1, name: 'Mauricio Farfán', email: 'estudiante@unsa.edu.pe', phone: '987654321', role: 'Estudiante', suspended: false, 
    loans: [{ item: 'Laptop Dell XPS 13', code: 'EL-2041', category: 'Electrónica', date: '2026-09-25', daysLeft: 3, status: 'LOANED' }], sanctions: [] 
  },
  { 
    id: 2, name: 'Carlos Mendoza', email: 'operador@unsa.edu.pe', phone: '987654322', role: 'Operador', suspended: false, 
    loans: [], sanctions: [] 
  },
  { 
    id: 3, name: 'Dr. Jorge Ramirez', email: 'admin@unsa.edu.pe', phone: '987654323', role: 'Admin', suspended: false, 
    loans: [], sanctions: [] 
  },
  { 
    id: 4, name: 'Carlos Herrera', email: 'cherrera@unsa.edu.pe', phone: '987654324', role: 'Estudiante', suspended: true, 
    loans: [
      { item: 'Kit de Fútbol', code: 'DP-0071', category: 'Deporte', date: '2026-09-20', daysLeft: -3, status: 'LOANED' }, 
      { item: 'Laptop Dell XPS 13', code: 'EL-2041', category: 'Electrónica', date: '2026-08-10', status: 'RETURNED' }
    ], 
    sanctions: [
      { id: 101, rule: 'RN-11: Devolución oportuna', reason: 'Devolución con retraso', item: 'Kit de Fútbol', itemCode: 'DP-0071', level: 'GRAVE', days: 30, date: '2026-09-20', until: '2026-10-20' }
    ] 
  },
  { 
    id: 5, name: 'Lucía Méndez', email: 'lmendez@unsa.edu.pe', phone: '987654325', role: 'Estudiante', suspended: true, 
    loans: [
      { item: 'Proyector Epson EB-X51', code: 'EL-1032', category: 'Electrónica', date: '2026-09-12', status: 'RETURNED' }
    ], 
    sanctions: [
      { id: 102, rule: 'RN-11: Devolución oportuna', reason: 'Devolución con retraso', item: 'Proyector Epson EB-X51', itemCode: 'EL-1032', level: 'GRAVE', days: 30, date: '2026-09-18', until: '2026-10-18' }
    ] 
  }
])

const appeals = ref<Appeal[]>([
  { 
    id: 1, userId: 5, sanctionId: 102, studentName: 'Lucía Méndez', email: 'lmendez@unsa.edu.pe', itemName: 'Proyector Epson EB-X51', itemCode: 'EL-1032', sanctionLevel: 'GRAVE', sanctionDays: 30, date: '2026-09-28', reason: 'Llegué al módulo de préstamos a las 5:10 p. m. y estaba cerrado por un corte de luz en la facultad. Devolví el proyector completo al día siguiente a primera hora.', status: 'PENDIENTE' 
  }
])

const pendingAppealsCount = computed(() => appeals.value.filter(a => a.status === 'PENDIENTE').length)
const sortedAppeals = computed(() => [...appeals.value].sort((a, b) => Number(b.status === 'PENDIENTE') - Number(a.status === 'PENDIENTE')))
const normalizeText = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const filteredUsers = computed(() => { 
  const q = normalizeText(userSearch.value.trim()); 
  if (!q) return users.value; 
  return users.value.filter(u => normalizeText([u.name, u.email, u.phone, u.role, u.suspended ? 'suspendido' : 'activo'].join(' ')).includes(q)) 
})

// --- Lógica del Lado del Estudiante ---
const currentUser = ref<AppUser | null>(null)
const showAppealModal = ref<boolean>(false)
const appealText = ref<string>('')

const isSuspended = computed(() => !!currentUser.value?.suspended)
const studentLevel = computed(() => (isSuspended.value ? 'Bajo' : 'Alto'))
const activeSanction = computed<SanctionRecord | null>(() => currentUser.value?.sanctions[0] ?? null)
const myAppeal = computed<Appeal | null>(() => { 
  if (!currentUser.value || !activeSanction.value) return null; 
  return appeals.value.find(a => a.userId === currentUser.value!.id && a.sanctionId === activeSanction.value!.id) ?? null 
})
const myActiveLoans = computed<LoanRecord[]>(() => currentUser.value?.loans.filter(l => l.status === 'LOANED') ?? [])
const isOverdue = (loan: LoanRecord): boolean => (loan.daysLeft ?? 0) < 0
const availableByCategory = computed(() => { 
  const totals = { electricos: 0, libros: 0, deportes: 0 }; 
  for (const item of allCatalogItems.value) {
    totals[item.category] += item.availableCount;
  }
  return totals 
})
const canReserve = computed(() => !!selectedItem.value && selectedItem.value.availableCount > 0 && !isSuspended.value)

// --- Base de Datos del Catálogo ---
const allCatalogItems = ref<CatalogItem[]>([
  { 
    category: 'electricos', categoryName: 'Electrónico', code: 'EL-2041', name: 'Laptop Dell XPS 13', description: 'Intel Core i7, 16GB RAM, 512GB SSD. Ideal para presentaciones y trabajo de campo.', stockText: '2 disponibles', availableCount: 2, totalCount: 5, maxTime: 'Máx. 7 días', 
    parts: ['Laptop', 'Cargador original', 'Funda protectora', 'Mouse inalámbrico'], 
    history: [
      { user: 'Mauricio Farfán', date: '2026-09-25', status: 'LOANED' }, 
      { user: 'Carlos Herrera', date: '2026-08-10', status: 'RETURNED' }
    ] 
  },
  { 
    category: 'electricos', categoryName: 'Electrónico', code: 'EL-1032', name: 'Proyector Epson EB-X51', description: 'Proyector 3LCD, 3600 lúmenes, resolución XGA. Incluye cable HDMI y control remoto.', stockText: '3 disponibles', availableCount: 3, totalCount: 4, maxTime: 'Máx. 3 días', 
    parts: ['Proyector', 'Cable HDMI', 'Control remoto', 'Maletín de transporte'], 
    history: [
      { user: 'Lucía Méndez', date: '2026-09-12', status: 'RETURNED' }
    ] 
  },
  { 
    category: 'electricos', categoryName: 'Electrónico', code: 'EL-3009', name: 'Tablet Samsung Tab S9', description: 'Android 14, 12.4" AMOLED, lápiz S Pen incluido. Para laboratorios digitales.', stockText: 'Agotado (0 disp.)', availableCount: 0, totalCount: 3, maxTime: 'Máx. 5 días', 
    parts: ['Tablet', 'Lápiz S Pen', 'Funda original', 'Cargador'], 
    history: [] 
  },
  { 
    category: 'libros', categoryName: 'Libro', code: 'LB-0441', name: 'Algoritmos — Cormen 4ed', description: 'Cormen, Leiserson, Rivest, Stein. Cuarta edición en inglés. Referencia obligatoria.', stockText: '1 disponibles', availableCount: 1, totalCount: 2, maxTime: 'Máx. 14 días', 
    parts: ['Libro físico en buen estado', 'Protector plástico'], 
    history: [
      { user: 'Ana Torres', date: '2026-09-01', status: 'RETURNED' }
    ] 
  },
  { 
    category: 'libros', categoryName: 'Libro', code: 'LB-0890', name: 'Clean Code — Robert Martin', description: 'Guía de craftsmanship para el desarrollo ágil de software limpio.', stockText: 'Agotado (0 disp.)', availableCount: 0, totalCount: 1, maxTime: 'Máx. 14 días', 
    parts: ['Libro físico'], 
    history: [
      { user: 'Pedro Gómez', date: '2026-08-20', status: 'RETURNED' }
    ] 
  },
  { 
    category: 'deportes', categoryName: 'Deportes', code: 'DP-0071', name: 'Kit de Fútbol', description: 'Balón oficial FIFA, 4 conos de entrenamiento y 2 chalecos de equipo.', stockText: '4 disponibles', availableCount: 4, totalCount: 4, maxTime: 'Máx. 2 días', 
    parts: ['Balón de fútbol', '4 Conos', '2 Chalecos'], 
    history: [] 
  }
])

const filteredItems = computed(() => {
  return allCatalogItems.value.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
      item.description.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
      item.code.toLowerCase().includes(searchQuery.value.toLowerCase())
    
    // En la vista de administrador, mostramos TODO (incluso los agotados)
    const matchesAvailability = view.value === 'admin-catalog' ? true : (!onlyAvailable.value || item.availableCount > 0)
    
    return matchesSearch && matchesAvailability
  })
})

const electricosItems = computed(() => filteredItems.value.filter(i => i.category === 'electricos'))
const librosItems = computed(() => filteredItems.value.filter(i => i.category === 'libros'))
const deportesItems = computed(() => filteredItems.value.filter(i => i.category === 'deportes'))

// --- Acciones del Sistema, Navegación y Login ---
const openItemDetail = (item: CatalogItem): void => { 
  selectedItem.value = item; 
  view.value = 'item-detail' 
}

const goHome = (): void => { 
  if (isAdmin.value) view.value = 'admin-appeals'; 
  else view.value = isOperator.value ? 'operator-home' : 'student-home' 
}

const showToast = (message: string): void => { 
  toast.value = message; 
  setTimeout(() => { toast.value = '' }, 4000) 
}

const enterApp = (fullEmail: string): void => {
  const found = users.value.find(u => u.email.toLowerCase() === fullEmail.toLowerCase())
  currentUser.value = found ?? { 
    id: 0, name: fullEmail.split('@')[0], email: fullEmail.toLowerCase(), phone: '', role: 'Estudiante', suspended: false, loans: [], sanctions: [] 
  }
  if (found?.role === 'Admin') { 
    role.value = 'admin'; 
    view.value = 'admin-appeals' 
  } else if (found?.role === 'Operador') { 
    role.value = 'operator'; 
    operatorTab.value = 'active'; 
    view.value = 'operator-home' 
  } else { 
    role.value = 'student'; 
    view.value = 'student-home' 
  }
}

const handleLogin = (): void => { 
  if (!emailInput.value.endsWith('@unsa.edu.pe')) {
    alert('Acceso denegado: Solo correos @unsa.edu.pe permitidos.')
    return 
  }
  loggingIn.value = true; 
  setTimeout(() => { 
    loggingIn.value = false; 
    enterApp(emailInput.value.trim()) 
  }, 500) 
}

const showMainView = (): void => { 
  view.value = 'main'; 
  loggingIn.value = false; 
  role.value = 'student' 
}

const showGoogleView = (): void => { 
  view.value = 'google'; 
  googleEmailLocal.value = ''; 
  googleError.value = null 
}

const stripGoogleDomain = (value: string): string => { 
  const d = '@unsa.edu.pe'; 
  return value.toLowerCase().endsWith(d) ? value.slice(0, value.length - d.length) : value 
}

const onGoogleEmailInput = (): void => { 
  googleError.value = null; 
  googleEmailLocal.value = stripGoogleDomain(googleEmailLocal.value) 
}

const handleGoogleContinue = (): void => { 
  const local = stripGoogleDomain(googleEmailLocal.value.trim()); 
  if (!local || /[\s@]/.test(local)) return; 
  const fullEmail = local.toLowerCase() + '@unsa.edu.pe'; 
  if (!registeredEmails.value.includes(fullEmail)) return; 
  enterApp(fullEmail) 
}

const showRegisterView = (): void => { 
  view.value = 'register'; 
  canCheckRegister.value = false; 
  registerChecked.value = false; 
  nextTick(() => { 
    if (registerScroll.value) {
      registerScroll.value.scrollTop = 0 
    }
  }) 
}

const checkRegisterScroll = (): void => { 
  const el = registerScroll.value; 
  if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
    canCheckRegister.value = true 
  }
}

const scrollToCategory = (categoryKey: string): void => { 
  view.value = 'catalog'; 
  searchQuery.value = ''; 
  nextTick(() => { 
    if (!catalogContainer.value) return; 
    if (categoryKey === 'all') {
      catalogContainer.value.scrollTop = 0; 
    } else {
      document.getElementById(`section-${categoryKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) 
    }
  }) 
}

// --- Métodos de Estudiante ---
const openAppealModal = (): void => { 
  appealText.value = ''; 
  showAppealModal.value = true 
}

const closeAppealModal = (): void => { 
  showAppealModal.value = false 
}

const submitAppeal = (): void => { 
  const u = currentUser.value; 
  const s = activeSanction.value; 
  const t = appealText.value.trim(); 
  if (!u || !s || !t) return; 

  appeals.value.push({ 
    id: Math.max(0, ...appeals.value.map(a => a.id)) + 1, 
    userId: u.id, 
    sanctionId: s.id, 
    studentName: u.name, 
    email: u.email, 
    itemName: s.item, 
    itemCode: s.itemCode, 
    sanctionLevel: s.level, 
    sanctionDays: s.days, 
    date: new Date().toLocaleDateString('sv-SE'), 
    reason: t, 
    status: 'PENDIENTE' 
  }); 

  closeAppealModal(); 
  showToast('Apelación enviada para revisión.') 
}

// --- Métodos de Operador ---
const openChecklist = (loan: OperatorLoan): void => { 
  selectedLoan.value = loan; 
  checkedParts.value = [...checklistParts.value]; 
  onTime.value = !loan.overdue; 
  showReturnModal.value = true 
}

const closeReturnModal = (): void => { 
  showReturnModal.value = false; 
  selectedLoan.value = null 
}

const confirmReceive = (): void => { 
  if (!selectedLoan.value) return; 
  toast.value = onTime.value ? `Equipo recibido de ${selectedLoan.value.borrower}.` : `Se aplicó sanción a ${selectedLoan.value.borrower} por retraso.`; 
  setTimeout(() => { toast.value = '' }, 4000); 
  operatorLoans.value = operatorLoans.value.filter(l => l.id !== selectedLoan.value!.id); 
  closeReturnModal() 
}

// --- Métodos de Administrador ---
const toggleSuspension = (user: AppUser): void => { 
  user.suspended = !user.suspended; 
  showToast(user.suspended ? `La cuenta de ${user.name} ha sido suspendida.` : `Se ha levantado la suspensión a ${user.name}.`) 
}

const onRoleChange = (user: AppUser): void => { 
  showToast(`El rol de ${user.name} ahora es ${user.role}.`) 
}

const resolveAppeal = (appeal: Appeal, approve: boolean): void => { 
  appeal.status = approve ? 'APROBADA' : 'RECHAZADA'; 
  if (approve) { 
    const user = users.value.find(u => u.id === appeal.userId); 
    if (user) { 
      user.sanctions = user.sanctions.filter(sc => sc.id !== appeal.sanctionId); 
      user.suspended = false 
    } 
  } 
  showToast(approve ? 'Apelación aprobada y sanción anulada.' : 'Apelación rechazada.') 
}

const openUserHistory = (user: AppUser): void => { 
  historyUser.value = user 
}

const closeUserHistory = (): void => { 
  historyUser.value = null 
}

const openAddProduct = () => { 
  isEditingProduct.value = false; 
  productForm.value = { category: 'electricos', code: '', name: '', description: '', totalCount: 1, maxTime: 'Máx. 7 días', partsString: '' }; 
  showProductModal.value = true 
}

const openEditProduct = (item: CatalogItem) => { 
  isEditingProduct.value = true; 
  productForm.value = { category: item.category, code: item.code, name: item.name, description: item.description, totalCount: item.totalCount, maxTime: item.maxTime, partsString: item.parts.join(', ') }; 
  showProductModal.value = true 
}

const closeProductModal = () => { 
  showProductModal.value = false 
}

const saveProduct = () => {
  const partsArray = productForm.value.partsString.split(',').map(p => p.trim()).filter(p => p !== '')
  const catName = categoryLabels[productForm.value.category as keyof typeof categoryLabels]
  
  if (isEditingProduct.value) {
    const idx = allCatalogItems.value.findIndex(i => i.code === productForm.value.code)
    if (idx !== -1) {
      const old = allCatalogItems.value[idx]
      const countDiff = productForm.value.totalCount - old.totalCount
      const newAvail = Math.max(0, old.availableCount + countDiff)
      allCatalogItems.value[idx] = { 
        ...old, 
        category: productForm.value.category as CatalogItem['category'], 
        categoryName: catName, 
        name: productForm.value.name, 
        description: productForm.value.description, 
        totalCount: productForm.value.totalCount, 
        availableCount: newAvail, 
        stockText: newAvail > 0 ? `${newAvail} disp.` : 'Agotado (0 disp.)', 
        maxTime: productForm.value.maxTime, 
        parts: partsArray 
      }
      showToast('Artículo del inventario modificado.')
    }
  } else {
    if (allCatalogItems.value.some(i => i.code === productForm.value.code)) {
      return alert('Ya existe este código de artículo en el inventario.')
    }
    allCatalogItems.value.push({ 
      category: productForm.value.category as CatalogItem['category'], 
      categoryName: catName, 
      code: productForm.value.code, 
      name: productForm.value.name, 
      description: productForm.value.description, 
      totalCount: productForm.value.totalCount, 
      availableCount: productForm.value.totalCount, 
      stockText: `${productForm.value.totalCount} disp.`, 
      maxTime: productForm.value.maxTime, 
      parts: partsArray, 
      history: [] 
    })
    showToast('Nuevo artículo añadido exitosamente al catálogo.')
  }
  closeProductModal()
}
</script>