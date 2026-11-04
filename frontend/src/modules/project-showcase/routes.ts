import type { RouteRecordRaw } from 'vue-router'
import ProjectLayout from './ProjectLayout.vue'
import ProjectOverviewPage from './pages/ProjectOverviewPage.vue'
import ProjectArchitecturePage from './pages/ProjectArchitecturePage.vue'
import ProjectApiPage from './pages/ProjectApiPage.vue'
import ProjectDbPage from './pages/ProjectDbPage.vue'
import ProjectTermsPage from './pages/ProjectTermsPage.vue'
import ProjectTeamPage from './pages/ProjectTeamPage.vue'

export const projectRoutes: RouteRecordRaw[] = [
  {
    path: '/project',
    component: ProjectLayout,
    children: [
      { path: '', component: ProjectOverviewPage },
      { path: 'architecture', component: ProjectArchitecturePage },
      { path: 'api', component: ProjectApiPage },
      { path: 'db', component: ProjectDbPage },
      { path: 'terms', component: ProjectTermsPage },
      { path: 'data', redirect: '/project/architecture' },
      { path: 'team', component: ProjectTeamPage },
    ],
  },
]
