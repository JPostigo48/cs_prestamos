import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from './modules/auth/pages/LoginPage.vue'
import RegistrationRequestPage from './modules/auth/pages/RegistrationRequestPage.vue'
import StudentAppPage from './modules/users/pages/StudentAppPage.vue'
import { getSession } from './modules/auth/api/auth-api'
import { clearSession } from './modules/auth/api/auth-api'
import { canAccess, homeFor, safeDestination } from './modules/auth/access-policy'
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
        { path: 'catalog', component: () => import('./modules/inventory/pages/CatalogPage.vue') },
        {
          path: 'catalog/:resourceId',
          component: () => import('./modules/inventory/pages/ResourceDetailPage.vue'),
        },
        { path: 'loans', component: () => import('./modules/loans/pages/LoanOperationsPage.vue') },
        {
          path: 'reservations',
          component: () => import('./modules/loans/pages/ReservationsPage.vue'),
        },
        {
          path: 'admin/catalog',
          component: () => import('./modules/inventory/pages/InventoryManagementPage.vue'),
        },
        { path: 'admin/appeals', component: () => import('./modules/trust/pages/AppealsPage.vue') },
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
    if (to.path === '/app' && session.user.role !== 'USUARIO') return homeFor(session.user.role)
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
