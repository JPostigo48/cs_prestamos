<template>
  <div class="min-h-screen w-full bg-[#f5f7fb] text-slate-900 lg:flex">
    
    <!-- === PANEL LATERAL (NAV) === -->
    <aside class="flex w-[232px] shrink-0 flex-col bg-[#1e3a5f] text-white">
      <div class="flex h-[72px] items-center gap-3 border-b border-white/10 px-4">
        <img src="/logo.png" alt="" class="h-9 w-9 object-contain bg-white rounded p-1" />
        <span class="font-bold text-sm tracking-tight leading-tight">CS Préstamos</span>
      </div>
      <nav class="space-y-1 px-3 py-4" aria-label="Navegación del usuario">
        
        <template v-if="role === 'student'">
          <button 
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition" 
            :class="view === 'student-home' ? 'bg-[#294f82] font-semibold text-white' : 'text-blue-100 hover:bg-white/10'" 
            @click="emit('switchView', 'student-home')"
          >
            <span class="text-lg">⌂</span> Inicio
          </button>
          <button 
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition" 
            :class="view === 'catalog' || view === 'item-detail' ? 'bg-[#294f82] font-semibold text-white' : 'text-blue-100 hover:bg-white/10'" 
            @click="emit('catalog', 'all')"
          >
            <span class="text-lg">▦</span> Catálogo
          </button>
        </template>
        
        <template v-else-if="role === 'operator'">
          <button 
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition" 
            :class="view === 'operator-home' ? 'bg-[#294f82] font-semibold text-white' : 'text-blue-100 hover:bg-white/10'" 
            @click="emit('switchView', 'operator-home')"
          >
            <span class="text-lg">📦</span> Panel Operador
          </button>
          <button 
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition" 
            :class="view === 'catalog' || view === 'item-detail' ? 'bg-[#294f82] font-semibold text-white' : 'text-blue-100 hover:bg-white/10'" 
            @click="emit('catalog', 'all')"
          >
            <span class="text-lg">▦</span> Catálogo
          </button>
        </template>
        
        <template v-else-if="role === 'admin'">
          <button 
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition" 
            :class="view === 'admin-appeals' ? 'bg-[#294f82] font-semibold text-white' : 'text-blue-100 hover:bg-white/10'" 
            @click="emit('switchView', 'admin-appeals')"
          >
            <span class="text-lg">⚖️</span> Apelaciones 
            <span v-if="pendingAppealsCount > 0" class="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{{ pendingAppealsCount }}</span>
          </button>
          <button 
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition" 
            :class="view === 'admin-users' ? 'bg-[#294f82] font-semibold text-white' : 'text-blue-100 hover:bg-white/10'" 
            @click="emit('switchView', 'admin-users')"
          >
            <span class="text-lg">👥</span> Usuarios
          </button>
          <button 
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition" 
            :class="view === 'admin-catalog' ? 'bg-[#294f82] font-semibold text-white' : 'text-blue-100 hover:bg-white/10'" 
            @click="emit('switchView', 'admin-catalog')"
          >
            <span class="text-lg">🗂️</span> Catálogo (Inventario)
          </button>
          <button 
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition" 
            :class="view === 'operator-home' ? 'bg-[#294f82] font-semibold text-white' : 'text-blue-100 hover:bg-white/10'" 
            @click="emit('switchView', 'operator-home')"
          >
            <span class="text-lg">📦</span> Panel Operador
          </button>
        </template>

      </nav>
    </aside>

    <!-- === CONTENIDO PRINCIPAL === -->
    <div class="min-w-0 flex-1 flex flex-col h-screen">
      
      <!-- TOPBAR -->
      <header class="flex min-h-[72px] items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 shrink-0">
        <label v-if="view === 'student-home' || view === 'catalog'" class="relative block w-full max-w-[470px]">
          <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 5 5" />
          </svg>
          <input 
            v-model="search" 
            type="search" 
            placeholder="Buscar recursos en catálogo..." 
            class="w-full rounded-md border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500" 
            @input="view === 'student-home' && emit('catalog', 'all')" 
          />
        </label>
        <div v-else class="text-lg font-bold text-slate-800 uppercase tracking-wide">
          Panel Institucional
        </div>
        
        <div class="flex shrink-0 items-center gap-5">
          <span class="text-sm font-semibold">{{ user?.name }}</span>
          <button type="button" class="text-sm text-slate-500 hover:text-red-600 font-bold transition" @click="emit('logout')">
            Salir
          </button>
        </div>
      </header>

      <!-- SCROLLABLE AREA -->
      <main class="mx-auto w-full max-w-[1480px] space-y-7 px-6 py-8 xl:px-9 flex-grow overflow-y-auto">
        
        <div v-if="toast" role="status" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          {{ toast }}
        </div>

        <!-- 1. VISTA: ESTUDIANTE INICIO -->
        <template v-if="view === 'student-home'">
          <section>
            <p class="text-sm text-slate-500">Bienvenido/a,</p>
            <h1 class="mt-1 text-3xl font-bold tracking-tight">{{ user?.name }}</h1>
            <div class="mt-3 flex flex-wrap gap-2">
              <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="suspended ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'">
                ● Cuenta {{ suspended ? 'suspendida' : 'habilitada' }}
              </span>
              <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                ★ Nivel de confianza: {{ level }}
              </span>
            </div>
          </section>

          <section v-if="suspended" class="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 shadow-sm">
            <h2 class="font-semibold">{{ activeSanction ? 'Sanción activa' : 'Cuenta suspendida' }}</h2>
            <p class="mt-1">{{ activeSanction ? activeSanction.reason + '. Vigente hasta ' + activeSanction.until + '.' : 'Comunícate con la Escuela de Ciencias de la Computación para más información.' }}</p>
            <button 
              v-if="activeSanction && !appeal" 
              type="button" 
              class="mt-3 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 transition" 
              @click="emit('openAppeal')"
            >
              Apelar sanción
            </button>
            <p v-else-if="appeal" class="mt-2 font-bold">Apelación: {{ appeal.status.toLowerCase() }}.</p>
          </section>

          <section>
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-lg font-bold">Explorar catálogo</h2>
              <button type="button" class="text-sm font-medium text-blue-600 hover:underline" @click="emit('catalog', 'all')">Ver todo ›</button>
            </div>
            <div class="grid gap-4 md:grid-cols-3">
              <button type="button" class="rounded-xl bg-[#edf4ff] p-5 text-left hover:ring-2 hover:ring-blue-300 transition" @click="emit('catalog', 'electricos')">
                <span class="text-xl text-blue-600">▣</span>
                <h3 class="mt-2 font-bold text-slate-800">Electrónicos</h3>
                <p class="mt-3 border-t border-white/70 pt-3 text-xs font-semibold text-emerald-700">{{ availableByCategory.electricos }} disp.</p>
              </button>
              <button type="button" class="rounded-xl bg-[#fbf4ff] p-5 text-left hover:ring-2 hover:ring-purple-300 transition" @click="emit('catalog', 'libros')">
                <span class="text-xl text-purple-600">▥</span>
                <h3 class="mt-2 font-bold text-slate-800">Libros</h3>
                <p class="mt-3 border-t border-white/70 pt-3 text-xs font-semibold text-emerald-700">{{ availableByCategory.libros }} disp.</p>
              </button>
              <button type="button" class="rounded-xl bg-[#effbf3] p-5 text-left hover:ring-2 hover:ring-emerald-300 transition" @click="emit('catalog', 'deportes')">
                <span class="text-xl text-emerald-600">◇</span>
                <h3 class="mt-2 font-bold text-slate-800">Deportes</h3>
                <p class="mt-3 border-t border-white/70 pt-3 text-xs font-semibold text-emerald-700">{{ availableByCategory.deportes }} disp.</p>
              </button>
            </div>
          </section>

          <section>
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-lg font-bold">Mis préstamos activos</h2>
              <span class="text-sm text-slate-500 font-medium">{{ loans.length }} activos</span>
            </div>
            <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table class="w-full min-w-[650px] text-left text-sm">
                <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th class="px-5 py-3">Artículo</th>
                    <th class="px-5 py-3">Categoría</th>
                    <th class="px-5 py-3">Fecha / hora límite</th>
                    <th class="px-5 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(loan, index) in loans" :key="loan.code ?? index" class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td class="px-5 py-4">
                      <strong class="text-slate-900">{{ loan.item }}</strong>
                      <span class="block text-xs text-slate-500 font-mono mt-0.5">{{ loan.code }}</span>
                    </td>
                    <td class="px-5 py-4 text-slate-600 font-medium">{{ loan.category }}</td>
                    <td class="px-5 py-4">
                      {{ loan.date }}
                      <span v-if="loan.daysLeft !== undefined" class="ml-2 text-xs font-bold" :class="loan.daysLeft < 0 ? 'text-red-600' : 'text-amber-700'">
                        {{ loan.daysLeft }}d rest.
                      </span>
                    </td>
                    <td class="px-5 py-4">
                      <span class="rounded-full px-3 py-1 text-xs font-bold border tracking-wide uppercase" :class="(loan.daysLeft ?? 0) < 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'">
                        {{ (loan.daysLeft ?? 0) < 0 ? 'En mora' : 'Activo' }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="loans.length === 0">
                    <td colspan="4" class="px-5 py-6 text-center text-slate-500">No tienes préstamos activos.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <!-- 2. VISTA: CATÁLOGO -->
        <template v-else-if="view === 'catalog'">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p class="text-sm text-slate-500 uppercase tracking-wide font-bold">Explorar recursos</p>
              <h1 class="text-3xl font-extrabold text-slate-900">Catálogo</h1>
              <p class="mt-1 text-sm text-slate-500 font-medium">{{ visibleItems.length }} recursos encontrados</p>
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-600 font-bold bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
              <input v-model="onlyAvailable" type="checkbox" class="w-4 h-4 rounded border-slate-300 text-blue-600" /> Solo disponibles
            </label>
          </div>

          <div class="flex flex-wrap gap-2">
            <button 
              v-for="category in categories" 
              :key="category.key" 
              type="button" 
              class="rounded-lg px-4 py-2 text-sm font-medium transition" 
              :class="selectedCategory === category.key ? 'bg-[#1e3a5f] text-white shadow' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'" 
              @click="emit('catalog', category.key)"
            >
              {{ category.label }}
            </button>
          </div>

          <div v-if="visibleItems.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <button 
              v-for="item in visibleItems" 
              :key="item.code" 
              type="button" 
              class="rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-300 hover:shadow-md flex flex-col h-full" 
              @click="emit('selectItem', item.code)"
            >
              <div class="flex items-start justify-between gap-3 w-full">
                <span class="px-2.5 py-1 bg-slate-100 rounded-md text-[10px] font-bold text-slate-600 uppercase tracking-wider">{{ item.categoryName }}</span>
                <span class="text-xs text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded border border-slate-100">{{ item.code }}</span>
              </div>
              <h2 class="mt-4 font-bold text-lg text-slate-900 leading-tight">{{ item.name }}</h2>
              <p class="mt-1 line-clamp-2 text-sm text-slate-500 flex-grow">{{ item.description }}</p>
              <div class="mt-5 flex justify-between border-t border-slate-100 pt-3 text-xs w-full">
                <span class="font-bold" :class="item.availableCount ? 'text-emerald-700' : 'text-red-600'">
                  {{ item.availableCount }} disponibles
                </span>
                <span class="text-slate-500 font-medium">{{ item.maxTime }}</span>
              </div>
            </button>
          </div>
          <div v-else class="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <p class="text-lg font-bold text-slate-500">No se encontraron recursos con los filtros aplicados.</p>
          </div>
        </template>

        <!-- 3. VISTA: DETALLE ARTÍCULO -->
        <template v-else-if="view === 'item-detail' && selectedItem">
          <button type="button" class="text-sm font-bold text-slate-500 hover:text-blue-600 transition flex items-center gap-2" @click="emit('catalog', selectedCategory)">
            ← Volver al catálogo
          </button>
          <div class="mt-4">
            <span class="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-full uppercase tracking-wide">{{ selectedItem.categoryName }}</span>
            <h1 class="mt-3 text-4xl font-extrabold text-slate-900">{{ selectedItem.name }}</h1>
            <p class="mt-1 text-sm text-slate-500 font-mono bg-white inline-block px-2 py-1 rounded mt-2 border border-slate-200">Código: {{ selectedItem.code }}</p>
          </div>

          <div class="grid gap-6 xl:grid-cols-2 mt-6">
            <section class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col justify-center">
              <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900">Descripción</h2>
              <p class="mt-3 text-sm text-slate-600 leading-relaxed">{{ selectedItem.description }}</p>
              
              <h2 class="mt-8 text-sm font-bold uppercase tracking-wider text-slate-900">Partes y accesorios (Checklist)</h2>
              <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div v-for="part in selectedItem.parts" :key="part" class="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 flex items-center gap-3">
                  <span class="w-2 h-2 rounded-full bg-blue-500"></span>{{ part }}
                </div>
              </div>
            </section>

            <section class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col justify-center">
              <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 mb-6">Disponibilidad Actual</h2>
              
              <div class="flex items-end gap-3 mb-5">
                <span class="text-6xl font-extrabold leading-none tracking-tight" :class="selectedItem.availableCount ? 'text-emerald-600' : 'text-red-500'">
                  {{ selectedItem.availableCount }}
                </span>
                <div class="pb-1">
                  <span class="text-base font-bold text-slate-700 block">{{ selectedItem.availableCount ? 'ejemplares disponibles' : 'artículo agotado' }}</span>
                  <span class="text-sm text-slate-500">de {{ selectedItem.totalCount }} en el inventario total</span>
                </div>
              </div>
              
              <div class="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-8 shadow-inner">
                <div 
                  class="h-full rounded-full transition-all duration-500" 
                  :class="selectedItem.availableCount ? 'bg-emerald-500' : 'bg-red-500'" 
                  :style="{ width: (selectedItem.availableCount / selectedItem.totalCount) * 100 + '%' }"
                ></div>
              </div>

              <button 
                v-if="!['operator','admin'].includes(role)" 
                :disabled="!selectedItem.availableCount || suspended" 
                class="w-full py-4 rounded-xl text-sm font-bold transition shadow-md" 
                :class="selectedItem.availableCount && !suspended ? 'bg-[#1e3a5f] hover:bg-[#152a45] text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'"
              >
                {{ suspended ? 'Reservas deshabilitadas (Cuenta suspendida)' : (selectedItem.availableCount ? 'Reservar equipo' : 'Sin disponibilidad por el momento') }}
              </button>
            </section>
          </div>

          <section class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm mt-6">
            <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 mb-6 flex items-center gap-2">
              🕒 Historial Completo del Artículo
            </h2>
            <div v-if="selectedItem.history.length" class="space-y-4">
              <div v-for="(record, index) in selectedItem.history" :key="index" class="flex justify-between items-center border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <div>
                  <h4 class="text-sm font-bold text-slate-900">{{ record.user }}</h4>
                  <p class="text-xs text-slate-500 mt-1 font-medium">{{ record.date }}</p>
                </div>
                <span class="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="record.status === 'LOANED' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-slate-100 text-slate-600 border border-slate-200'">
                  {{ record.status }}
                </span>
              </div>
            </div>
            <p v-else class="text-sm text-slate-400 italic py-6 text-center bg-slate-50 rounded-xl">Este artículo no registra préstamos anteriores en el sistema.</p>
          </section>
        </template>

        <!-- 4. VISTA: ADMIN APELACIONES -->
        <template v-else-if="view === 'admin-appeals'">
          <div class="mb-8">
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Apelaciones Recibidas</h1>
            <p class="text-sm text-slate-500 mt-2 font-medium">{{ pendingAppealsCount }} apelación(es) pendiente(s) de revisión y veredicto</p>
          </div>
          
          <div class="space-y-5">
            <div 
              v-for="appeal in sortedAppeals" 
              :key="appeal.id" 
              class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm transition" 
              :class="{'opacity-60': appeal.status !== 'PENDIENTE'}"
            >
              <div class="flex justify-between items-start mb-6">
                <div>
                  <h4 class="text-xl font-bold text-slate-900">{{ appeal.studentName }}</h4>
                  <p class="text-sm text-slate-500 mt-1">{{ appeal.email }}</p>
                </div>
                <span class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border" :class="appeal.status === 'PENDIENTE' ? 'bg-amber-50 text-amber-800 border-amber-200' : appeal.status === 'APROBADA' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'">
                  {{ appeal.status }}
                </span>
              </div>
              
              <div class="grid grid-cols-3 gap-6 text-sm text-slate-700 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div><p class="text-xs font-bold text-slate-400 mb-1">EQUIPO</p><p class="font-medium">{{ appeal.itemName }} ({{ appeal.itemCode }})</p></div>
                <div><p class="text-xs font-bold text-slate-400 mb-1">SANCIÓN APLICADA</p><p class="font-medium text-red-600">{{ appeal.sanctionLevel }} ({{ appeal.sanctionDays }} días)</p></div>
                <div><p class="text-xs font-bold text-slate-400 mb-1">FECHA DE APELACIÓN</p><p class="font-medium">{{ appeal.date }}</p></div>
              </div>
              
              <div class="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
                <p class="text-xs font-bold text-slate-500 tracking-wider mb-3">ARGUMENTO DEL ESTUDIANTE</p>
                <p class="text-sm text-slate-800 leading-relaxed italic border-l-4 border-slate-300 pl-4">"{{ appeal.reason }}"</p>
              </div>
              
              <div v-if="appeal.status === 'PENDIENTE'" class="flex gap-4 justify-end border-t border-slate-100 pt-5 mt-2">
                <button @click="emit('resolveAppeal', appeal, false)" class="px-8 py-3 rounded-xl text-sm font-bold bg-white hover:bg-red-50 text-red-600 border border-slate-300 hover:border-red-200 transition shadow-sm">Rechazar y Mantener Sanción</button>
                <button @click="emit('resolveAppeal', appeal, true)" class="px-8 py-3 rounded-xl text-sm font-bold bg-[#1e3a5f] hover:bg-[#152a45] text-white transition shadow-md">Aprobar Apelación (Anular Sanción)</button>
              </div>
            </div>
            
            <div v-if="appeals.length === 0" class="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm text-lg font-medium">
              No hay apelaciones registradas en el sistema.
            </div>
          </div>
        </template>

        <!-- 5. VISTA: ADMIN USUARIOS -->
        <template v-else-if="view === 'admin-users'">
          <div class="flex justify-between items-end mb-8">
            <div>
              <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Gestión de Usuarios</h1>
              <p class="text-sm text-slate-500 mt-2 font-medium">Modifica roles, gestiona suspensiones y visualiza historiales completos</p>
            </div>
            <div class="relative w-96">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input v-model="userSearch" type="text" placeholder="Buscar usuario por nombre, correo o celular..." class="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-white shadow-sm font-medium">
            </div>
          </div>
          
          <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <tr>
                  <th class="px-6 py-5">Información del Usuario</th>
                  <th class="px-6 py-5">Estado de Cuenta</th>
                  <th class="px-6 py-5">Rol del Sistema</th>
                  <th class="px-6 py-5 text-right">Acciones Administrativas</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in filteredUsers" :key="u.id" class="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td class="px-6 py-5">
                    <div class="font-extrabold text-slate-900 text-base">{{ u.name }}</div>
                    <div class="text-xs text-slate-500 mt-1 font-medium">{{ u.email }} | {{ u.phone }}</div>
                  </td>
                  <td class="px-6 py-5">
                    <span class="px-3 py-1.5 rounded-md text-[10px] font-bold border tracking-wide uppercase" :class="u.suspended ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'">
                      {{ u.suspended ? 'SUSPENDIDO' : 'HABILITADO' }}
                    </span>
                  </td>
                  <td class="px-6 py-5">
                    <span v-if="u.role === 'Admin'" class="font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">Administrador</span>
                    <select v-else v-model="u.role" @change="emit('changeRole', u, u.role)" class="px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 bg-white focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm">
                      <option value="Estudiante">Estudiante</option>
                      <option value="Operador">Operador</option>
                    </select>
                  </td>
                  <td class="px-6 py-5 text-right space-x-4">
                    <button @click="emit('openHistory', u)" class="text-blue-600 hover:text-blue-800 font-bold text-sm underline-offset-4 hover:underline transition">Historial Completo</button>
                    <button 
                      v-if="u.role !== 'Admin'" 
                      @click="emit('toggleSuspension', u)" 
                      class="px-5 py-2.5 rounded-lg text-xs font-bold border transition shadow-sm" 
                      :class="u.suspended ? 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white hover:bg-red-50 text-red-600 border-red-300'"
                    >
                      {{ u.suspended ? 'Levantar Suspensión' : 'Suspender Cuenta' }}
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredUsers.length === 0">
                  <td colspan="4" class="px-6 py-12 text-center text-slate-500 text-lg font-medium">No se encontraron usuarios con ese término de búsqueda.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- 6. VISTA: ADMIN CATÁLOGO (Inventario) -->
        <template v-else-if="view === 'admin-catalog'">
          <div class="flex justify-between items-end mb-8">
            <div>
              <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Gestión del Inventario</h1>
              <p class="text-sm text-slate-500 mt-2 font-medium">Añade o modifica los artículos del catálogo general de la facultad</p>
            </div>
            <div class="flex items-center gap-4">
              <div class="relative w-80">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input v-model="search" type="text" placeholder="Buscar por nombre o código..." class="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-white shadow-sm font-medium">
              </div>
              <button @click="emit('openAddProduct')" class="px-6 py-3 bg-[#1e3a5f] hover:bg-[#152a45] text-white rounded-xl text-sm font-bold shadow-md transition flex items-center gap-2">
                <span>➕</span> Nuevo Artículo
              </button>
            </div>
          </div>
          
          <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <tr>
                  <th class="px-6 py-5 w-5/12">Datos del Artículo</th>
                  <th class="px-6 py-5">Categoría</th>
                  <th class="px-6 py-5 text-center">Disponibilidad</th>
                  <th class="px-6 py-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in visibleItems" :key="item.code" class="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td class="px-6 py-5">
                    <div class="font-extrabold text-slate-900 text-base">{{ item.name }}</div>
                    <div class="text-xs text-slate-500 mt-1.5 font-mono bg-slate-100 inline-block px-2 py-1 rounded border border-slate-200">{{ item.code }}</div>
                  </td>
                  <td class="px-6 py-5">
                    <span class="px-3 py-1.5 bg-white text-slate-700 text-[10px] font-bold rounded-lg uppercase tracking-wide border border-slate-300 shadow-sm">{{ item.categoryName }}</span>
                  </td>
                  <td class="px-6 py-5 text-center">
                    <span class="text-lg font-extrabold" :class="item.availableCount > 0 ? 'text-emerald-600' : 'text-red-500'">{{ item.availableCount }}</span>
                    <span class="text-sm text-slate-400 font-bold"> / {{ item.totalCount }}</span>
                  </td>
                  <td class="px-6 py-5 text-right">
                    <button @click="emit('openEditProduct', item)" class="px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2 ml-auto">
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
                <tr v-if="visibleItems.length === 0">
                  <td colspan="4" class="px-6 py-12 text-center text-slate-500 text-lg font-medium">No hay artículos que coincidan con la búsqueda.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- 7. VISTA: OPERADOR HOME -->
        <template v-else-if="view === 'operator-home'">
          <div class="mb-8">
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Panel del Operador</h1>
            <p class="text-sm text-slate-500 mt-2 font-medium">Gestiona las devoluciones de equipos y verifica los checklists</p>
          </div>
          
          <div class="flex gap-2 mb-8 border-b border-slate-200 pb-px">
            <button 
              @click="operatorTab = 'active'" 
              class="px-8 py-4 text-sm font-bold border-b-2 transition" 
              :class="operatorTab === 'active' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-500 hover:text-slate-800'"
            >
              Préstamos Activos ({{ operatorLoans.length }})
            </button>
            <button 
              @click="operatorTab = 'overdue'" 
              class="px-8 py-4 text-sm font-bold border-b-2 transition" 
              :class="operatorTab === 'overdue' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-red-600'"
            >
              Equipos en Mora ({{ operatorLoans.filter(l=>l.overdue).length }})
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div 
              v-for="loan in visibleOperatorLoans" 
              :key="loan.id" 
              class="bg-white p-8 rounded-2xl border shadow-sm flex flex-col justify-between transition hover:shadow-md" 
              :class="loan.overdue ? 'border-red-300 bg-red-50/30' : 'border-slate-200'"
            >
              <div class="mb-6">
                <div class="flex justify-between items-start mb-4">
                  <h4 class="text-xl font-bold text-slate-900">{{ loan.borrower }}</h4>
                  <span v-if="loan.overdue" class="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">MORA</span>
                </div>
                <p class="text-base text-slate-800 font-bold">{{ loan.itemName }}</p>
                <p class="text-sm text-slate-500 font-mono mt-1 mb-4">{{ loan.itemCode }}</p>
                <div class="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm" :class="loan.overdue ? 'border-red-200' : 'border-slate-200'">
                  <span class="text-xs font-bold text-slate-500">Límite:</span>
                  <span class="text-sm font-bold" :class="loan.overdue ? 'text-red-600' : 'text-slate-800'">{{ loan.dueDate }}</span>
                </div>
              </div>
              <button 
                @click="emit('openChecklist', loan)" 
                class="w-full py-4 rounded-xl text-sm font-bold transition shadow-sm border" 
                :class="loan.overdue ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'"
              >
                ✓ Revisar Checklist y Recibir Equipo
              </button>
            </div>

            <div v-if="visibleOperatorLoans.length === 0" class="col-span-full p-16 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm text-xl font-bold">
              No hay préstamos en esta categoría.
            </div>
          </div>
        </template>
        
      </main>
    </div>

    <!-- === MODALES DESKTOP (PANTALLA COMPLETA) === -->

    <!-- 1. Modal Apelación (Estudiante) -->
    <div v-if="appealOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm">
      <div class="w-full max-w-lg rounded-3xl bg-white p-10 shadow-2xl">
        <h2 class="text-2xl font-extrabold text-slate-900">Formular apelación</h2>
        <p class="mt-3 text-sm text-slate-600">Motivo original de la sanción: <strong class="text-slate-800">{{ activeSanction?.reason }}</strong></p>
        
        <textarea 
          v-model="appealText" 
          rows="5" 
          placeholder="Explica tu justificación detalladamente o agrega enlaces de evidencia (Google Drive)..." 
          class="mt-6 w-full resize-none rounded-xl border border-slate-300 p-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 bg-slate-50 focus:bg-white transition"
        ></textarea>
        
        <div class="mt-8 flex justify-end gap-4">
          <button type="button" class="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-6 py-3 text-sm font-bold transition text-slate-700 shadow-sm" @click="emit('closeAppeal')">Cancelar</button>
          <button type="button" :disabled="!appealText.trim()" class="rounded-xl bg-[#1e3a5f] hover:bg-[#152a45] px-8 py-3 text-sm font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md" @click="emit('submitAppeal')">Enviar apelación al administrador</button>
        </div>
      </div>
    </div>

    <!-- 2. Modal Historial Usuario (Admin) -->
    <div v-if="historyModalOpen && historyUser" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm">
      <div class="w-full max-w-2xl rounded-3xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
        <div class="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center rounded-t-3xl shrink-0">
          <div>
            <h2 class="text-2xl font-extrabold text-slate-900">Historial Completo del Usuario</h2>
            <p class="text-sm text-slate-600 mt-1 font-medium">{{ historyUser.name }} ({{ historyUser.email }})</p>
          </div>
          <button @click="emit('closeHistory')" class="w-10 h-10 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center font-bold text-slate-600 transition">✕</button>
        </div>
        
        <div class="p-8 overflow-y-auto space-y-10">
          <div>
            <h3 class="text-sm font-bold text-slate-500 tracking-wider mb-5 border-b border-slate-100 pb-2">PRÉSTAMOS REGISTRADOS</h3>
            <div class="space-y-4">
              <div v-for="(loan, i) in historyUser.loans" :key="i" class="border-l-4 border-blue-500 bg-white border border-slate-200 rounded-xl p-5 flex justify-between items-center shadow-sm">
                <div class="min-w-0 pr-4">
                  <p class="text-base font-bold text-slate-900 truncate">{{ loan.item }}</p>
                  <p class="text-sm text-slate-500 mt-1">Categoría: {{ loan.category }} | Fecha límite/real: {{ loan.date }}</p>
                </div>
                <span class="px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-bold text-xs tracking-wider shrink-0 uppercase">{{ loan.status }}</span>
              </div>
              <p v-if="!historyUser.loans.length" class="text-sm text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center">No registra préstamos.</p>
            </div>
          </div>
          
          <div>
            <h3 class="text-sm font-bold text-slate-500 tracking-wider mb-5 border-b border-slate-100 pb-2">SANCIONES RECIBIDAS</h3>
            <div class="space-y-4">
              <div v-for="sanction in historyUser.sanctions" :key="sanction.id" class="border-l-4 border-red-500 bg-red-50/50 border border-red-100 rounded-xl p-5 shadow-sm">
                <div class="flex justify-between mb-3">
                  <p class="text-base font-extrabold text-red-800">{{ sanction.level }} ({{ sanction.days }} días)</p>
                  <span class="text-xs px-3 py-1 rounded-md bg-red-200 text-red-900 font-bold tracking-widest">ACTIVA</span>
                </div>
                <p class="text-sm text-slate-800 font-bold">{{ sanction.item }} ({{ sanction.itemCode }})</p>
                <p class="text-sm text-slate-600 mt-1 italic">{{ sanction.reason }}</p>
                <div class="mt-4 flex items-center gap-2 text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 inline-flex">
                  <span>📅</span> Vigente hasta {{ sanction.until }}
                </div>
              </div>
              <p v-if="!historyUser.sanctions.length" class="text-sm text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center">No registra sanciones en su historial.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Modal Recepción (Operador) -->
    <div v-if="returnModalOpen && selectedLoan" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm">
      <div class="w-full max-w-lg rounded-3xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div class="px-8 py-6 bg-[#1e3a5f] text-white shrink-0">
          <h2 class="text-2xl font-extrabold">Recepción de Equipo</h2>
          <p class="text-sm text-blue-200 mt-2 font-medium">{{ selectedLoan.itemName }} - <span class="text-white font-bold">{{ selectedLoan.borrower }}</span></p>
        </div>
        
        <div class="p-8 space-y-8 overflow-y-auto">
          <div>
            <h3 class="text-base font-bold text-slate-900 mb-4">Verificación del Checklist</h3>
            <div class="border border-slate-200 bg-slate-50 rounded-xl p-5 space-y-4">
              <label v-for="part in checklistParts" :key="part" class="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer hover:text-blue-600 transition">
                <input type="checkbox" :value="part" v-model="checkedParts" class="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shadow-sm"> 
                <span>{{ part }}</span>
              </label>
            </div>
          </div>
          
          <div class="border-t border-slate-200 pt-8 space-y-4">
            <h3 class="text-base font-bold text-slate-900 mb-2">Estado de la Devolución</h3>
            <label class="flex items-center gap-3 px-6 py-5 rounded-xl border text-sm font-bold cursor-pointer transition shadow-sm" :class="onTime ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'">
              <input type="checkbox" v-model="onTime" class="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"> 
              <span>Equipo entregado dentro de la fecha y hora límite</span>
            </label>
            
            <div v-if="!onTime" class="bg-red-50 border border-red-200 rounded-xl p-5 shadow-inner mt-4">
              <p class="text-xs font-extrabold text-red-700 tracking-wider mb-2">⚠ SANCIÓN AUTOMÁTICA DEL SISTEMA</p>
              <p class="text-sm text-red-700 leading-relaxed">Al confirmar la recepción, el sistema aplicará automáticamente una sanción <strong>{{ currentSanction?.level }} ({{ currentSanction?.days }} días)</strong> al estudiante basada en las políticas de la categoría del equipo.</p>
            </div>
          </div>
          
          <div class="flex gap-4 pt-4 border-t border-slate-100">
            <button @click="emit('closeReturnModal')" class="flex-1 py-4 rounded-xl text-sm font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition shadow-sm">Cancelar Operación</button>
            <button @click="emit('confirmReceive')" class="flex-1 py-4 rounded-xl text-sm font-bold bg-[#1e3a5f] hover:bg-[#152a45] text-white transition shadow-md">Confirmar Recepción</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Modal Formulario Producto (Admin Catálogo) -->
    <div v-if="productModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm">
      <div class="w-full max-w-2xl rounded-3xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div class="px-10 py-8 bg-slate-50 border-b border-slate-200 flex justify-between items-center rounded-t-3xl shrink-0">
          <div>
            <h2 class="text-2xl font-extrabold text-slate-900">{{ isEditingProduct ? 'Modificar Artículo' : 'Nuevo Artículo' }}</h2>
            <p class="text-sm text-slate-500 mt-2 font-medium">{{ isEditingProduct ? 'Actualiza los datos y la disponibilidad del equipo en el sistema.' : 'Ingresa los datos del nuevo equipo para añadirlo al catálogo general de la facultad.' }}</p>
          </div>
          <button @click="emit('closeProductModal')" class="w-10 h-10 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center font-bold text-slate-600 transition">✕</button>
        </div>
        
        <div class="p-10 overflow-y-auto space-y-6">
          <div class="grid grid-cols-2 gap-6">
            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold text-slate-600 tracking-wider">CÓDIGO (ID ÚNICO)</label>
              <input type="text" v-model="productForm.code" :disabled="isEditingProduct" placeholder="Ej: EL-1234" class="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500 font-mono transition">
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold text-slate-600 tracking-wider">CATEGORÍA DEL EQUIPO</label>
              <select v-model="productForm.category" class="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white font-medium transition cursor-pointer">
                <option value="electricos">Equipos Electrónicos</option>
                <option value="libros">Libros y Material Bibliográfico</option>
                <option value="deportes">Material Deportivo</option>
              </select>
            </div>
          </div>
          
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold text-slate-600 tracking-wider">NOMBRE DEL ARTÍCULO</label>
            <input type="text" v-model="productForm.name" placeholder="Ej: Laptop Dell XPS 13" class="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition font-bold">
          </div>
          
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold text-slate-600 tracking-wider">DESCRIPCIÓN DETALLADA</label>
            <textarea v-model="productForm.description" rows="3" placeholder="Detalles técnicos, estado, recomendaciones, observaciones generales..." class="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none transition leading-relaxed"></textarea>
          </div>
          
          <div class="grid grid-cols-2 gap-6">
            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold text-slate-600 tracking-wider">TIEMPO MÁX. PRÉSTAMO</label>
              <input type="text" v-model="productForm.maxTime" placeholder="Ej: Máx. 7 días" class="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition">
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold text-slate-600 tracking-wider">CANTIDAD TOTAL (INVENTARIO)</label>
              <input type="number" min="1" v-model="productForm.totalCount" class="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition font-bold">
            </div>
          </div>
          
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold text-slate-600 tracking-wider flex justify-between">
              <span>PARTES Y ACCESORIOS</span>
              <span class="text-slate-400 font-normal normal-case">Separados por coma</span>
            </label>
            <textarea v-model="productForm.partsString" rows="2" placeholder="Ej: Laptop, Cargador, Mouse inalámbrico, Funda de transporte" class="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none transition leading-relaxed"></textarea>
            <div class="bg-blue-50 border border-blue-100 rounded-lg p-3 mt-1 flex gap-2 items-start">
              <span class="text-blue-500 text-lg leading-none">ℹ️</span>
              <p class="text-xs text-blue-800 font-medium">Estas partes generarán automáticamente el checklist de devolución (obligatorio) para el operador logístico.</p>
            </div>
          </div>
        </div>
        
        <div class="p-8 bg-slate-50 border-t border-slate-200 flex gap-4 shrink-0 rounded-b-3xl">
          <button @click="emit('closeProductModal')" class="flex-1 py-4 rounded-xl text-sm font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition shadow-sm">Cancelar Edición</button>
          <button @click="emit('saveProduct')" :disabled="!productForm.code || !productForm.name || productForm.totalCount < 1" class="flex-1 py-4 rounded-xl text-sm font-bold text-white transition bg-[#1e3a5f] hover:bg-[#152a45] disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md">
            {{ isEditingProduct ? 'Guardar Cambios en Sistema' : 'Crear y Publicar Artículo' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// --- Tipos e Interfaces Exportadas ---
type Category = 'all' | 'electricos' | 'libros' | 'deportes'
type Role = 'student' | 'operator' | 'admin'

interface HistoryRecord { 
  user: string; 
  date: string; 
  status: string 
}

interface CatalogItem { 
  category: Exclude<Category, 'all'>; 
  categoryName: string; 
  code: string; 
  name: string; 
  description: string; 
  availableCount: number; 
  totalCount: number; 
  maxTime: string; 
  parts: string[]; 
  history: HistoryRecord[] 
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

interface LoanRecord { 
  item: string; 
  code?: string; 
  category?: string; 
  date: string; 
  daysLeft?: number; 
  status: string 
}

interface OperatorLoan { 
  id: number; 
  borrower: string; 
  itemName: string; 
  itemCode: string; 
  dueDate: string; 
  overdue: boolean 
}

interface AppUser { 
  id: number; 
  name: string; 
  email: string; 
  phone: string; 
  role: string; 
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

// --- Props (Recibidas desde ApplicationPrototypePage) ---
const props = defineProps<{
  view: string
  role: Role
  user: AppUser | null
  suspended: boolean
  level: string
  activeSanction: SanctionRecord | null
  appeal: Appeal | null
  loans: LoanRecord[]
  items: CatalogItem[]
  catalogItems: CatalogItem[]
  selectedItem: CatalogItem | null
  selectedCategory: Category
  availableByCategory: Record<Exclude<Category, 'all'>, number>
  users: AppUser[]
  filteredUsers: AppUser[]
  operatorLoans: OperatorLoan[]
  visibleOperatorLoans: OperatorLoan[]
  appeals: Appeal[]
  sortedAppeals: Appeal[]
  pendingAppealsCount: number
  historyUser: AppUser | null
  selectedLoan: OperatorLoan | null
  checklistParts: string[]
  currentSanction: { level: string; days: number } | null
  toast: string
  appealOpen: boolean
  returnModalOpen: boolean
  historyModalOpen: boolean
  productModalOpen: boolean
  isEditingProduct: boolean
  productForm: any
}>()

// --- Emits (Eventos hacia ApplicationPrototypePage) ---
const emit = defineEmits<{
  home: []
  catalog: [category: Category]
  selectItem: [code: string]
  logout: []
  openAppeal: []
  closeAppeal: []
  submitAppeal: []
  switchView: [view: string]
  resolveAppeal: [appeal: Appeal, approve: boolean]
  toggleSuspension: [user: AppUser]
  changeRole: [user: AppUser, newRole: string]
  openHistory: [user: AppUser]
  closeHistory: []
  openChecklist: [loan: OperatorLoan]
  closeReturnModal: []
  confirmReceive: []
  openAddProduct: []
  openEditProduct: [item: CatalogItem]
  closeProductModal: []
  saveProduct: []
}>()

// --- Models (Two-Way Binding) ---
const search = defineModel<string>('search', { required: true })
const onlyAvailable = defineModel<boolean>('onlyAvailable', { required: true })
const appealText = defineModel<string>('appealText', { required: true })
const userSearch = defineModel<string>('userSearch', { required: true })
const operatorTab = defineModel<'active' | 'overdue'>('operatorTab', { required: true })
const checkedParts = defineModel<string[]>('checkedParts', { required: true })
const onTime = defineModel<boolean>('onTime', { required: true })

// --- Constantes Estáticas ---
const categories: { key: Category; label: string }[] = [
  { key: 'all', label: 'Ver Todos' },
  { key: 'electricos', label: 'Electrónicos' },
  { key: 'libros', label: 'Libros y Textos' },
  { key: 'deportes', label: 'Artículos Deportivos' }
]

// --- Computed Locals ---
// Nota: El filtro `props.items` ya viene calculado desde el padre, aquí solo aplicamos
// el filtro de los botones de categoría si seleccionan algo específico en el Desktop.
const visibleItems = computed(() => props.items.filter(item =>
  props.selectedCategory === 'all' || item.category === props.selectedCategory
))
</script>
