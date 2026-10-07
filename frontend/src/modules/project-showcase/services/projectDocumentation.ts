import type { ArchitectureData, BacklogItem, GitData, OpenApiDocument, PlanningData, TeamData, WeekProgress } from '../types'

const base = `${import.meta.env.BASE_URL}generated/project`

async function readGenerated<T>(file: string): Promise<T | null> {
  try {
    const response = await fetch(`${base}/${file}`)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

export const projectDocumentation = {
  planning: () => readGenerated<PlanningData>('planning.json'),
  backlog: () => readGenerated<BacklogItem[]>('backlog.json'),
  architecture: () => readGenerated<ArchitectureData>('architecture.json'),
  team: () => readGenerated<TeamData>('team.json'),
  progress: () => readGenerated<WeekProgress[]>('team-progress.json'),
  git: () => readGenerated<GitData>('git.json'),
  openApi: () => readGenerated<OpenApiDocument>('openapi.json'),
}
