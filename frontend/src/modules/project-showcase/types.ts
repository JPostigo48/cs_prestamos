export interface Sprint {
  sprint: number
  name: string
  status: string
  version: string
  objective: string
  result: string
  members: { name: string; responsibility: string; branch: string }[]
  planIds: string[]
  source: string
}

export interface PlanningData {
  project: string
  technologies: { area: string; technology: string }[]
  sprints: Sprint[]
}

export interface BacklogItem {
  id: string
  description: string
  module: string
  owner: string
  priority: string
  sprint: string
  version: string
  status: string
}

export interface Diagram {
  title: string
  source: string
  image: string | null
  type: 'Dominio' | 'Arquitectura' | 'Contextos'
}

export interface ArchitectureData {
  diagrams: Diagram[]
  structurizr: string
}

export interface WeekProgress {
  week: number
  sprint: number
  start: string
  end: string
  status: string
  members: { name: string; planned: string[]; done: string[]; pending: string[]; blockers: string[] }[]
  source: string
}

export interface GitData {
  branchTypes: { prefix: string; purpose: string }[]
  versions: { sprint: string; version: string; prefix: string }[]
  source: string
}

export interface OpenApiSchema {
  $ref?: string
  type?: string
  format?: string
  example?: unknown
  allOf?: OpenApiSchema[]
  enum?: string[]
  items?: OpenApiSchema
  properties?: Record<string, OpenApiSchema>
  required?: string[]
  nullable?: boolean
}

export interface OpenApiMediaType {
  schema?: OpenApiSchema
  example?: unknown
  examples?: Record<string, { value?: unknown }>
}

export interface OpenApiOperation {
  tags?: string[]
  summary?: string
  description?: string
  operationId?: string
  parameters?: { name: string; in: string; required?: boolean; schema?: OpenApiSchema }[]
  requestBody?: { content?: Record<string, OpenApiMediaType> }
  responses?: Record<string, { description?: string; content?: Record<string, OpenApiMediaType> }>
  'x-implementation-status'?: 'implemented' | 'pending'
}

export interface OpenApiDocument {
  info?: { title?: string; version?: string }
  paths?: Record<string, Record<string, OpenApiOperation>>
  components?: { schemas?: Record<string, OpenApiSchema> }
}
