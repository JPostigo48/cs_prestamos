import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from './modules/auth/pages/LoginPage.vue'
import RegistrationRequestPage from './modules/auth/pages/RegistrationRequestPage.vue'
import StudentAppPage from './modules/users/pages/StudentAppPage.vue'
import { getSession } from './modules/auth/api/auth-api'
import ApplicationPrototypePage from './modules/prototype/pages/ApplicationPrototypePage.vue'
import { projectRoutes } from './modules/project-showcase/routes'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/project' },
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegistrationRequestPage },
    { path: '/app', component: StudentAppPage },
    { path: '/prototype', component: ApplicationPrototypePage },
    ...projectRoutes,
    { path: '/:pathMatch(.*)*', redirect: '/project' },
  ],
})

router.beforeEach((to) => {
  const session = getSession()
  if (to.path === '/app' && !session) return '/login'
  if (to.path === '/login' && session) return '/app'
})
