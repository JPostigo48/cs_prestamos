<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { House, Library, CalendarDays, ArrowLeftRight, ClipboardList, Scale, Users, Package, Ellipsis, Search, X, LogOut } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import { clearSession, getSession } from '../../modules/auth/api/auth-api'
import { isStaff } from '../../modules/auth/access-policy'

const session = getSession()
const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)
const content = ref<HTMLElement | null>(null)
const menuToggle = ref<HTMLButtonElement | null>(null)
const search = ref('')
const roleLabel = session?.user.role === 'ADMINISTRADOR' ? 'Administrador' : session?.user.role === 'OPERADOR' ? 'Operador' : 'Usuario'
const isCurrent = (to: string) => route.path === to || (to === '/app/catalog' && route.path.startsWith('/app/catalog/'))
const links = [
  ...(session?.user.role === 'ADMINISTRADOR' ? [
    { to: '/app/admin/appeals', label: 'Apelaciones', short: 'Apelaciones', icon: Scale },
    { to: '/app/admin/users', label: 'Usuarios', short: 'Usuarios', icon: Users },
    { to: '/app/admin/catalog', label: 'Catálogo (Inventario)', short: 'Inventario', icon: Package },
  ] : []),
  ...(session?.user.role === 'USUARIO' ? [{ to: '/app', label: 'Inicio', short: 'Inicio', icon: House }] : []),
  ...(session && isStaff(session.user.role) ? [
    { to: '/app/loans', label: 'Préstamos y devoluciones', short: 'Préstamos', icon: ArrowLeftRight },
  ] : []),
  { to: '/app/catalog', label: 'Catálogo', short: 'Catálogo', icon: Library },
  ...(session && isStaff(session.user.role) ? [
    { to: '/app/registrations', label: 'Solicitudes de registro', short: 'Solicitudes', icon: ClipboardList },
  ] : []),
  { to: '/app/reservations', label: 'Mis reservas y términos', short: 'Reservas', icon: CalendarDays },
]
const secondaryCurrent = computed(() => links.slice(3).find((link) => isCurrent(link.to)))
let desktopQuery: MediaQueryList | undefined
function resetMobileMenu() { menuOpen.value = false }
onMounted(() => {
  document.body.classList?.add('real-app-active')
  desktopQuery = window.matchMedia?.('(min-width: 1024px)')
  desktopQuery?.addEventListener('change', resetMobileMenu)
})
onBeforeUnmount(() => desktopQuery?.removeEventListener('change', resetMobileMenu))
onBeforeUnmount(() => document.body.classList?.remove('real-app-active'))
const removeNavigationHook = router.afterEach(async (_to, _from, failure) => {
  if (failure) return
  if (_to.path !== _from.path && content.value) content.value.scrollTop = 0
  if (!menuOpen.value) return
  menuOpen.value = false
  await nextTick()
  content.value?.focus()
})
onBeforeUnmount(removeNavigationHook)
async function closeMenu(restoreToggle = false) {
  menuOpen.value = false
  await nextTick()
  if (restoreToggle) menuToggle.value?.focus()
  else content.value?.focus()
}
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
      <nav id="app-navigation" :class="{ open: menuOpen }" aria-label="Navegación principal" @keydown.esc.prevent="closeMenu(true)">
        <strong class="brand sidebar-brand"><img src="/logo.png" alt="" />CS Préstamos</strong>
        <div class="mobile-menu-heading mobile-only"><strong>Navegación</strong><button type="button" aria-label="Cerrar navegación" @click="closeMenu(true)"><X :size="20" aria-hidden="true" /></button></div>
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" :class="{ 'is-active': isCurrent(link.to) }" :aria-current="isCurrent(link.to) ? (route.path === link.to ? 'page' : 'location') : undefined" @click="route.path === link.to && menuOpen && closeMenu()">
          <component :is="link.icon" :size="16" aria-hidden="true" /><span>{{ link.label }}</span>
        </RouterLink>
        <div class="mobile-account mobile-only"><p>{{ session?.user.email }} · {{ roleLabel }}</p><button @click="logout">Salir</button></div>
      </nav>
      <div class="content-shell" :inert="menuOpen || undefined">
        <header class="app-header">
          <strong class="brand mobile-only"><img src="/logo.png" alt="" />CS Préstamos</strong>
          <form v-if="route.path === '/app'" class="header-search" @submit.prevent="router.push({ path: '/app/catalog', query: { search: search.trim() || undefined } })">
            <label class="sr-only" for="header-resource-search">Buscar recursos</label><Search class="search-icon" :size="16" aria-hidden="true" /><input id="header-resource-search" v-model="search" type="search" maxlength="120" placeholder="Buscar recursos en catálogo…" />
            <button type="submit" class="sr-only">Buscar</button>
          </form>
          <span v-else class="header-title">Panel Institucional</span>
          <span class="identity"><span>{{ session?.user.email }}</span><small>{{ roleLabel }}</small></span>
          <button class="logout" type="button" @click="logout"><LogOut :size="16" aria-hidden="true" /><span>Salir</span></button>
        </header>
        <main id="app-content" ref="content" tabindex="-1"><RouterView /></main>
      </div>
    </div>
    <nav class="mobile-navigation" aria-label="Accesos principales">
      <RouterLink v-for="link in links.slice(0, 3)" :key="link.to" :to="link.to" :aria-current="isCurrent(link.to) ? 'page' : undefined" @click="menuOpen && closeMenu()"><component :is="link.icon" :size="20" aria-hidden="true" /><span>{{ link.short }}</span></RouterLink>
      <button ref="menuToggle" type="button" class="menu-toggle" :class="{ 'is-active': secondaryCurrent }" :aria-label="secondaryCurrent ? `Más · ${secondaryCurrent.label}, sección actual` : undefined" aria-controls="app-navigation" :aria-expanded="menuOpen" @click="toggleMenu"><Ellipsis :size="20" aria-hidden="true" /><span>Más</span></button>
    </nav>
  </div>
</template>

<style>
/* Compartido por las páginas reales, sin afectar al showcase ni al prototipo. */
@font-face {
  font-family: 'CS Inter';
  src: url('/fonts/inter/InterVariable.woff2') format('woff2');
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}
body.real-app-active { min-width: 0; }
.application *, .application *::before, .application *::after { box-sizing: border-box; }
.application .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; clip-path: inset(50%); overflow: hidden; white-space: nowrap; }
.application .mobile-navigation { display: none; }
.application {
  --app-sidebar-width: 232px;
  --app-header-height: 72px;
  --app-mobile-nav-height: calc(66px + env(safe-area-inset-bottom));
  height: 100dvh;
  overflow: hidden;
  background: #f5f7fb;
  color: #0f172a;
  font-family: 'CS Inter', Inter, 'Segoe UI', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  font-size: 1rem;
}
.application .app-header {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 1rem;
  height: var(--app-header-height);
  flex-shrink: 0;
  padding: 0 24px;
  background: white;
  color: #172b44;
  border-bottom: 1px solid #e2e8f0;
}
.application .brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -.025em;
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
  min-width: 0;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.application .identity small { display: block; color: #64748b; font-size: 11px; font-weight: 400; }
.application .header-title { color: #1e293b; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.application .app-header .logout { display: flex; align-items: center; gap: 6px; border: 0; padding: 8px 0; color: #64748b; font-size: 14px; font-weight: 700; flex-shrink: 0; }
.application .app-header .logout:hover { color: #dc2626; }
.application .app-body {
  display: flex;
  height: 100%;
  min-height: 0;
}
.application .content-shell { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
.application .sidebar-brand { width: auto; height: var(--app-header-height); flex-shrink: 0; margin: 0 -12px 16px; padding: 0 16px; border-bottom: 1px solid #ffffff1a; }
.application .header-search { position: relative; display: flex; flex: 1; min-width: 0; max-width: 470px; align-items: center; }
.application .header-search .search-icon { position: absolute; left: 12px; color: #94a3b8; pointer-events: none; }
.application .app-header .header-search input[type='search'] { min-width: 0; width: 100%; height: 42px; padding: 10px 12px 10px 40px; background: #f8fafc; border-color: #cbd5e1; border-radius: 6px; font-size: 14px; }
.application .header-search button:focus-visible { position: absolute; width: auto; height: auto; margin: 0; clip-path: none; right: 4px; overflow: visible; }
.application .mobile-only { display: none; }
.application .app-body > nav {
  width: var(--app-sidebar-width);
  flex-shrink: 0;
  padding: 0 12px 16px;
  background: #1e3a5f;
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
  color: white;
}
.application .app-body > nav a {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  padding: 10px 12px;
  min-height: 48px;
  margin-bottom: 4px;
  border-radius: 6px;
  line-height: 20px;
  color: #dbeafe;
}
.application .app-body > nav a:hover { background: #ffffff1a; color: white; }
.application .app-body > nav a.is-active {
  background: #294f82;
  color: white;
  font-weight: 600;
}
.application .content-shell > main {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
  min-height: 0;
  padding: 32px 24px;
  width: 100%;
  max-width: 1480px;
  min-width: 0;
  margin: 0 auto;
}
.application :is(button, input, select, textarea) { min-width: 0; max-width: 100%; }
.application button { overflow-wrap: anywhere; }
.application svg { flex-shrink: 0; }
.application h1 {
  font-size: 1.8rem;
  font-weight: 800;
  margin-bottom: 1rem;
}
.application h2 {
  font-size: 1.125rem;
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
  border: 1px solid #e2e8f0;
  border-radius: 8px;
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
  border: 1px solid #e2e8f0;
  border-radius: 8px;
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
.application button { transition: background-color .15s, border-color .15s, box-shadow .15s; }
.application .primary:hover:not(:disabled) { background: #163050; border-color: #163050; }
.application button:disabled { cursor: not-allowed; opacity: .55; }
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
  border: 1px solid #a7f3d0;
  border-radius: 8px;
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
  width: 100%;
  box-shadow: 0 24px 48px #0f172a40;
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
  background: #0f172a66;
  backdrop-filter: blur(4px);
}
.application dialog.compact { max-width: min(448px, calc(100vw - 2rem)); }
.application dialog label {
  display: block;
}
.application dialog textarea {
  width: 100%;
}
.application dialog :is(select, input:not([type='checkbox']):not([type='radio'])) { width: 100%; margin-top: 6px; }
.application dialog form > p { font-size: 14px; line-height: 1.6; color: #64748b; }
@media (max-width: 600px) {
  .application dialog.mobile-sheet { max-width: 100%; max-height: calc(100dvh - 16px); margin: auto 0 0; border-radius: 16px 16px 0 0; padding: 20px 16px calc(20px + env(safe-area-inset-bottom)); }
}
@media (max-width: 1023px) {
  .application { --app-header-height: 56px; }
  .application h1 { font-size: 20px; }
  .application .desktop-only { display: none; }
  .application .mobile-only { display: block; }
  .application .brand.mobile-only { display: flex; }
  .application .sidebar-brand { display: none; }
  .application .menu-toggle {
    display: flex;
  }
  .application .identity, .application .header-search, .application .header-title, .application .app-header > button { display: none; }
  .application .mobile-menu-heading { display: flex; align-items: center; justify-content: space-between; padding: 4px 12px 16px; }
  .application .mobile-menu-heading button { display: flex; padding: 10px; border: 0; color: white; background: transparent; }
  .application .mobile-account { overflow-wrap: anywhere; margin-top: 12px; }
  .application .app-body {
    padding-bottom: var(--app-mobile-nav-height);
  }
  .application .app-body > nav {
    display: none;
    width: 100%;
    height: auto;
    padding: 16px 12px 24px;
  }
  .application .app-body > nav.open {
    display: block;
  }
  .application .content-shell > main {
    padding: 16px 16px 24px;
    overflow-wrap: anywhere;
  }
  .application .app-header {
    height: var(--app-header-height);
    padding: 8px 16px;
  }
  .application .brand { width: auto; min-width: 0; font-size: 14px; }
  .application .mobile-navigation {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    position: fixed;
    inset: auto 0 0;
    z-index: 20;
    height: var(--app-mobile-nav-height);
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
    font-size: 10px;
    font-weight: 700;
    color: #64748b;
    line-height: 1.3;
    overflow-wrap: anywhere;
    text-decoration: none;
    border: 0;
    border-radius: 6px;
  }
  .application .mobile-navigation :is(a, button) { position: relative; }
  .application .mobile-navigation :is([aria-current='page'], [aria-expanded='true'], .is-active) { color: #1e3a5f; }
  .application .mobile-navigation :is([aria-current='page'], [aria-expanded='true'], .is-active)::after { content: ''; position: absolute; bottom: -6px; width: 48px; height: 4px; background: #1e3a5f; border-radius: 4px 4px 0 0; }
  .application :focus-visible { scroll-margin-block: 24px; }
  .application .mobile-navigation span { max-width: 100%; }
  .application .app-body > nav.open {
    position: fixed;
    inset: 0 0 var(--app-mobile-nav-height);
    z-index: 30;
  }
  .application .app-header > button:last-child {
    margin-left: auto;
  }
}
@media (min-width: 1280px) {
  .application .content-shell > main { padding-inline: 36px; }
}
</style>
