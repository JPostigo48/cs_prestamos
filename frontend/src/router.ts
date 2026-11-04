import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from './modules/auth/pages/LoginPage.vue'
import RegistrationRequestPage from './modules/auth/pages/RegistrationRequestPage.vue'
import StudentAppPage from './modules/users/pages/StudentAppPage.vue'
import { getSession, subscribeSessionChanges } from './modules/auth/api/auth-api'
import { clearSession } from './modules/auth/api/auth-api'
import { canAccess, safeDestination } from './modules/auth/access-policy'
import { onUnauthorized } from './shared/api/client'
import AppLayout from './shared/layouts/AppLayout.vue'
import AccessDeniedPage from './modules/auth/pages/AccessDeniedPage.vue'
import ApplicationPrototypePage from './modules/prototype/pages/ApplicationPrototypePage.vue'
import { projectRoutes } from './modules/project-showcase/routes'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/project' },
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegistrationRequestPage },
    { path: '/login/google', component: () => import('./modules/auth/pages/GoogleAccessPage.vue') },
    {
      path: '/app',
      component: AppLayout,
      meta: { authenticated: true },
      children: [
        { path: '', component: StudentAppPage },
        { path: 'personal', component: StudentAppPage, props: { personalOnly: true } },
        { path: 'catalog', component: () => import('./modules/inventory/pages/CatalogPage.vue') },
        {
          path: 'catalog/:resourceId',
          component: () => import('./modules/inventory/pages/ResourceDetailPage.vue'),
        },
        { path: 'loans', component: () => import('./modules/loans/pages/LoanOperationsPage.vue') },
        {
          path: 'terms',
          component: () => import('./modules/loans/pages/ReservationsPage.vue'),
        },
        { path: 'reservations', redirect: '/app/terms' },
        { path: 'history', component: () => import('./modules/loans/pages/MyHistoryPage.vue') },
        {
          path: 'admin/inventory',
          component: () => import('./modules/inventory/InventoryLayout.vue'),
          children: [
            { path: '', component: () => import('./modules/inventory/pages/InventoryManagementPage.vue') },
            { path: 'categories', component: () => import('./modules/inventory/pages/CategoriesPage.vue') },
          ],
        },
        { path: 'admin/catalog', redirect: to => ({ path: '/app/admin/inventory', query: to.query, hash: to.hash }) },
        { path: 'admin/appeals', component: () => import('./modules/trust/pages/AppealsPage.vue') },
        { path: 'admin/settings', component: () => import('./modules/system/pages/SystemSettingsPage.vue') },
        {
          path: 'admin/users',
          component: () => import('./modules/users/pages/UsersManagementPage.vue'),
        },
        {
          path: 'registrations',
          component: () => import('./modules/users/pages/RegistrationRequestsPage.vue'),
        },
        { path: 'denied', component: AccessDeniedPage },
      ],
    },
    { path: '/prototype', component: ApplicationPrototypePage },
    ...projectRoutes,
    { path: '/:pathMatch(.*)*', redirect: '/project' },
  ],
})

router.beforeEach((to) => {
  const session = getSession()
  if (to.meta.authenticated) {
    if (!session) return { path: '/login', query: { redirect: to.fullPath } }
    if (!canAccess(to.path, session.user.role)) return '/app/denied'
  }
  if (to.path === '/login' && session) return safeDestination(to.query.redirect, session.user.role)
})

function sessionExpired(): void {
  const current = router.currentRoute.value
  clearSession()
  if (current.meta.authenticated)
    void router.replace({ path: '/login', query: { redirect: current.fullPath } })
}
onUnauthorized((token) => {
  const session = getSession()
  if (!session || session.accessToken === token) sessionExpired()
})
window.addEventListener('session-expired', sessionExpired)

let currentSession = JSON.stringify(getSession())
router.afterEach((to, from, failure) => {
  // Al entrar desde una pantalla pública se monta una nueva UI. No actualizar
  // la identidad durante navegación protegida: podría ocultar un cambio remoto
  // cuyo evento storage todavía está en cola, dejando el layout antiguo vivo.
  if (!failure && to.meta.authenticated && !from.meta.authenticated)
    currentSession = JSON.stringify(getSession())
})
subscribeSessionChanges((session) => {
  const nextSession = JSON.stringify(session)
  if (nextSession === currentSession) return
  currentSession = nextSession
  const current = router.currentRoute.value
  if (!current.meta.authenticated) return
  if (!session) {
    void router.replace({ path: '/login', query: { redirect: current.fullPath } })
    return
  }
  // Los componentes capturan la sesión al montarse. Reconstruir toda la UI y
  // volver a pasar por el guard evita mezclar controles antiguos con otro token.
  window.location.reload()
})
