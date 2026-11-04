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

export interface TeamMember {
  initials: string
  name: string
}

export interface TeamMilestone {
  id: string
  title: string
  kind: 'task' | 'exam'
  date: string | null
  status: 'recorded' | 'in_progress'
  outcome: string
  progress: Record<string, string[]>
}

export interface TeamData {
  source: string
  members: TeamMember[]
  milestones: TeamMilestone[]
}

export interface GitData {
  branchTypes: { prefix: string; purpose: string }[]
  integrationPaths: { origin: string; method: string; review: string }[]
  versions: { sprint: string; version: string; prefix: string }[]
  source: string
}

export interface OpenApiSchema {
  $ref?: string
  type?: string
  format?: string
  example?: unknown
  allOf?: OpenApiSchema[]
  oneOf?: OpenApiSchema[]
  anyOf?: OpenApiSchema[]
  description?: string
  additionalProperties?: boolean | OpenApiSchema
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
  'x-roles'?: string[]
  'x-access-constraints'?: string
  'x-authentication'?: { required: boolean; scope: 'public' | 'authenticated' | 'roles' | 'custom-guards'; description: string; guards: string[] }
}

export interface OpenApiDocument {
  info?: { title?: string; version?: string }
  paths?: Record<string, Record<string, OpenApiOperation>>
  components?: { schemas?: Record<string, OpenApiSchema> }
}

export interface DbAttribute {
  name: string
  positional: unknown[]
  named: Record<string, unknown>
  raw: string
}
export interface DbField {
  name: string
  type: string
  typeExpression: string
  nullable: boolean
  list: boolean
  kind: 'scalar' | 'enum' | 'relation'
  attributes: DbAttribute[]
}
export interface DbRelation {
  source: string; field: string; target: string; inverse: string; name: string | null
  direction: 'outgoing' | 'incoming'
  sourceCardinality: string; targetCardinality: string
  owner: string; fields: string[]; references: string[]
  onDelete: string | null; onUpdate: string | null
}
export interface DbDocument {
  source: string
  models: { name: string; module: string; fields: DbField[]; attributes: DbAttribute[] }[]
  enums: { name: string; module: string; values: { name: string; attributes: DbAttribute[] }[]; attributes: DbAttribute[] }[]
  relations: DbRelation[]
}
