<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { House, Library, CalendarDays, ArrowLeftRight, ClipboardList, Scale, Users, Package, Ellipsis } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import { clearSession, getSession } from '../../modules/auth/api/auth-api'
import { isStaff } from '../../modules/auth/access-policy'

const session = getSession()
const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)
const content = ref<HTMLElement | null>(null)
const search = ref('')
const links = [
  ...(session?.user.role === 'USUARIO' ? [{ to: '/app', label: 'Inicio', short: 'Inicio', icon: House }] : []),
  { to: '/app/catalog', label: 'Catálogo', short: 'Catálogo', icon: Library },
  { to: '/app/reservations', label: 'Mis reservas y términos', short: 'Reservas', icon: CalendarDays },
  ...(session && isStaff(session.user.role) ? [
    { to: '/app/loans', label: 'Préstamos y devoluciones', short: 'Préstamos', icon: ArrowLeftRight },
    { to: '/app/registrations', label: 'Solicitudes de registro', short: 'Solicitudes', icon: ClipboardList },
  ] : []),
  ...(session?.user.role === 'ADMINISTRADOR' ? [
    { to: '/app/admin/appeals', label: 'Apelaciones', short: 'Apelaciones', icon: Scale },
    { to: '/app/admin/users', label: 'Usuarios', short: 'Usuarios', icon: Users },
    { to: '/app/admin/catalog', label: 'Catálogo (Inventario)', short: 'Inventario', icon: Package },
  ] : []),
]
onMounted(() => document.body.classList?.add('real-app-active'))
onBeforeUnmount(() => document.body.classList?.remove('real-app-active'))
const removeNavigationHook = router.afterEach(async (_to, _from, failure) => {
  if (failure || !menuOpen.value) return
  menuOpen.value = false
  await nextTick()
  content.value?.focus()
})
onBeforeUnmount(removeNavigationHook)
async function toggleMenu() {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) {
    await nextTick()
    document.getElementById('app-navigation')?.querySelector<HTMLElement>('a')?.focus()
  }
}
function logout() {
  clearSession()
  void router.replace('/login')
}
</script>

<template>
  <div class="application">
    <a class="skip-link" href="#app-content">Saltar al contenido</a>
    <div class="app-body">
      <nav id="app-navigation" :class="{ open: menuOpen }" aria-label="Navegación principal">
        <strong class="brand sidebar-brand"><img src="/logo.png" alt="" />CS Préstamos</strong>
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" :aria-current="route.path === link.to ? 'page' : undefined">
          <component :is="link.icon" :size="16" aria-hidden="true" /><span>{{ link.label }}</span>
        </RouterLink>
        <div class="mobile-account mobile-only"><p>{{ session?.user.email }} · {{ session?.user.role }}</p><button @click="logout">Salir</button></div>
      </nav>
      <div class="content-shell">
        <header class="app-header">
          <strong class="brand mobile-only"><img src="/logo.png" alt="" />CS Préstamos</strong>
          <form v-if="route.path === '/app' || route.path === '/app/catalog'" class="header-search" @submit.prevent="router.push({ path: '/app/catalog', query: { search: search.trim() || undefined } })">
            <label class="sr-only" for="header-resource-search">Buscar recursos</label><input id="header-resource-search" v-model="search" type="search" maxlength="120" placeholder="Buscar recursos en catálogo…" />
            <button>Buscar</button>
          </form>
          <span class="identity">{{ session?.user.email }} · {{ session?.user.role }}</span>
          <button type="button" @click="logout">Salir</button>
        </header>
        <main id="app-content" ref="content" tabindex="-1"><RouterView /></main>
      </div>
    </div>
    <nav class="mobile-navigation" aria-label="Accesos principales">
      <RouterLink v-for="link in links.slice(0, 3)" :key="link.to" :to="link.to" :aria-current="route.path === link.to ? 'page' : undefined"><component :is="link.icon" :size="20" aria-hidden="true" /><span>{{ link.short }}</span></RouterLink>
      <button type="button" class="menu-toggle" aria-controls="app-navigation" :aria-expanded="menuOpen" @click="toggleMenu"><Ellipsis :size="20" aria-hidden="true" /><span>Más</span></button>
    </nav>
  </div>
</template>

<style>
/* Compartido por las páginas reales, sin afectar al showcase ni al prototipo. */
body.real-app-active { min-width: 0; }
.application *, .application *::before, .application *::after { box-sizing: border-box; }
.application .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; clip-path: inset(50%); overflow: hidden; white-space: nowrap; }
.application .mobile-navigation { display: none; }
.application {
  min-height: 100dvh;
  background: #f5f7fb;
  color: #172b44;
  font-size: 1rem;
}
.application .app-header {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 1rem;
  height: 72px;
  padding: 0 24px;
  background: white;
  color: #172b44;
  border-bottom: 1px solid #e2e8f0;
}
.application .brand {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 200px;
}
.application .brand img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  padding: 4px;
  background: white;
  border-radius: 4px;
}
.application .identity {
  margin-left: auto;
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}
.application .app-body {
  display: flex;
}
.application .content-shell { flex: 1; min-width: 0; }
.application .sidebar-brand { width: auto; min-height: 72px; margin: -1rem -1rem 1rem; padding: 1rem; border-bottom: 1px solid #ffffff25; }
.application .header-search { display: flex; flex: 1; min-width: 0; max-width: 470px; align-items: center; gap: .5rem; }
.application .header-search input { min-width: 0; width: 100%; }
.application .header-search button { flex-shrink: 0; white-space: nowrap; }
.application .mobile-only { display: none; }
.application .app-body > nav {
  width: 232px;
  flex-shrink: 0;
  padding: 1rem;
  background: #1e3a5f;
  min-height: 100dvh;
  color: white;
}
.application .app-body > nav a {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  padding: 10px 12px;
  border-radius: 0.5rem;
}
.application .app-body > nav a.router-link-exact-active {
  background: #294f82;
}
.application .content-shell > main {
  padding: 2rem;
  width: 100%;
  max-width: 1400px;
  min-width: 0;
  margin: 0 auto;
}
.application :is(button, input, select, textarea) { min-width: 0; max-width: 100%; }
.application button { overflow-wrap: anywhere; }
.application svg { flex-shrink: 0; }
.application h1 {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 1rem;
}
.application h2 {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 0.7rem;
}
.application button,
.application input,
.application select,
.application textarea {
  font: inherit;
}
.application button {
  border: 1px solid #94a3b8;
  border-radius: 0.4rem;
  padding: 0.45rem 0.8rem;
  background: white;
  color: #172b44;
  cursor: pointer;
}
.application button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.application :focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 3px;
}
.application input:not([type='checkbox']):not([type='radio']),
.application select,
.application textarea {
  border: 1px solid #94a3b8;
  border-radius: 0.4rem;
  padding: 0.5rem;
  max-width: 100%;
  background: white;
  color: #172b44;
}
.application a:not(nav a) {
  text-decoration: underline;
}
.application .panel {
  background: white;
  border: 1px solid #dbe2ea;
  border-radius: 0.8rem;
  padding: 1.2rem;
  margin-bottom: 1rem;
  overflow-wrap: anywhere;
}
.application .cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 1rem;
}
.application .primary {
  background: #1e3a5f;
  color: white;
  border-color: #1e3a5f;
}
.application .badge {
  display: inline-block;
  background: #eff6ff;
  color: #1e40af;
  border-radius: 99px;
  padding: 0.25rem 0.65rem;
  font-size: 0.8rem;
  font-weight: 600;
}
.application .table-wrap {
  overflow-x: auto;
  max-width: 100%;
}
.application table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.application th {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #64748b;
  background: #f8fafc;
}
.application td,
.application th {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  overflow-wrap: anywhere;
}
.application .category-card {
  padding: 1.4rem;
  border-radius: 1rem;
  background: #eff6ff;
  border: 1px solid #dbeafe;
}
.application .category-card:nth-child(3n + 2) {
  background: #f0fdf4;
  border-color: #dcfce7;
}
.application .category-card:nth-child(3n) {
  background: #fff7ed;
  border-color: #ffedd5;
}
.application .error {
  color: #991b1b;
  background: #fff1f2;
  padding: 0.8rem;
  border-radius: 0.4rem;
  margin: 0.7rem 0;
}
.application .notice {
  background: #ecfdf5;
  color: #065f46;
  padding: 0.8rem;
  margin: 0.7rem 0;
}
.application .muted {
  color: #526174;
}
.application .stack > * + * {
  margin-top: 0.8rem;
}
.application .row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  align-items: center;
}
.application .row > label {
  min-width: 0;
  max-width: 100%;
}
.application .menu-toggle {
  display: none;
}
.application .skip-link {
  position: fixed;
  top: -100px;
  left: 1rem;
  z-index: 100;
  background: white;
  padding: 1rem;
  color: #172b44;
}
.application .skip-link:focus {
  top: 0;
}
.application dialog {
  max-width: min(560px, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow: auto;
  border: 0;
  border-radius: 0.8rem;
  padding: 1.5rem;
  margin: auto;
  color: #172b44;
  background: white;
  overflow-wrap: anywhere;
}
.application dialog::backdrop {
  background: #0f172aaa;
}
.application dialog label {
  display: block;
}
.application dialog textarea {
  width: 100%;
}
@media (max-width: 1023px) {
  html:has(body.real-app-active) { scroll-padding-bottom: calc(100px + env(safe-area-inset-bottom)); }
  .application .desktop-only { display: none; }
  .application .mobile-only { display: block; }
  .application .brand.mobile-only { display: flex; }
  .application .sidebar-brand { display: none; }
  .application .menu-toggle {
    display: flex;
  }
  .application .identity, .application .header-search, .application .app-header > button { display: none; }
  .application .mobile-account { overflow-wrap: anywhere; margin-top: 12px; }
  .application .app-body {
    display: block;
  }
  .application .app-body > nav {
    display: none;
    width: 100%;
    min-height: 0;
    padding-bottom: 24px;
  }
  .application .app-body > nav.open {
    display: block;
  }
  .application .content-shell > main {
    padding: 16px 16px calc(96px + env(safe-area-inset-bottom));
    overflow-wrap: anywhere;
  }
  .application .app-header {
    height: auto;
    min-height: 56px;
    padding: 8px 16px;
  }
  .application .brand { width: auto; min-width: 0; font-size: 14px; }
  .application .mobile-navigation {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    position: fixed;
    inset: auto 0 0;
    z-index: 20;
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
    background: white;
    border-top: 1px solid #dbe2ea;
  }
  .application .mobile-navigation :is(a, button) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 2px;
    min-width: 0;
    font-size: 12px;
    line-height: 1.3;
    overflow-wrap: anywhere;
    text-decoration: none;
    border: 0;
    border-radius: 6px;
  }
  .application .mobile-navigation [aria-current='page'], .application .mobile-navigation [aria-expanded='true'] { background: #eff6ff; color: #1d4ed8; }
  .application :focus-visible { scroll-margin-block: 24px 100px; }
  .application .mobile-navigation span { max-width: 100%; }
  .application .app-body > nav.open {
    position: relative;
  }
  .application .app-header > button:last-child {
    margin-left: auto;
  }
}
</style>
