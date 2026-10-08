import { createRouter, createWebHistory } from 'vue-router'
import LoginPrototypePage from './modules/auth/pages/LoginPrototypePage.vue'
import { projectRoutes } from './modules/project-showcase/routes'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/project' },
    { path: '/login', component: LoginPrototypePage },
    ...projectRoutes,
    { path: '/:pathMatch(.*)*', redirect: '/project' },
  ],
})
