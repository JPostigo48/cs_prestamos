import { createRouter, createWebHistory } from 'vue-router'
import LoginPrototypePage from './modules/auth/pages/LoginPrototypePage.vue'
import ApplicationPrototypePage from './modules/prototype/pages/ApplicationPrototypePage.vue'
import { projectRoutes } from './modules/project-showcase/routes'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/project' },
    { path: '/login', component: LoginPrototypePage },
    { path: '/prototype', component: ApplicationPrototypePage },
    ...projectRoutes,
    { path: '/:pathMatch(.*)*', redirect: '/project' },
  ],
})
