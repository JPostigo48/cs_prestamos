import type { RouteRecordRaw } from 'vue-router'
import ProjectLayout from './ProjectLayout.vue'
import ProjectOverviewPage from './pages/ProjectOverviewPage.vue'
import ProjectSprintsPage from './pages/ProjectSprintsPage.vue'
import ProjectArchitecturePage from './pages/ProjectArchitecturePage.vue'
import ProjectApiPage from './pages/ProjectApiPage.vue'
import ProjectTeamPage from './pages/ProjectTeamPage.vue'
import ProjectGitPage from './pages/ProjectGitPage.vue'

export const projectRoutes: RouteRecordRaw[] = [
  {
    path: '/project',
    component: ProjectLayout,
    children: [
      { path: '', component: ProjectOverviewPage },
      { path: 'sprints', component: ProjectSprintsPage },
      { path: 'architecture', component: ProjectArchitecturePage },
      { path: 'api', component: ProjectApiPage },
      { path: 'data', redirect: '/project/architecture' },
      { path: 'team', component: ProjectTeamPage },
      { path: 'git', component: ProjectGitPage },
    ],
  },
]
