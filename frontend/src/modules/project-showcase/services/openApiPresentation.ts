import type { OpenApiDocument, OpenApiMediaType, OpenApiOperation, OpenApiSchema } from '../types'

export function accessDescription(operation: OpenApiOperation): string | null {
  const auth = operation['x-authentication']
  if (auth?.scope === 'public') return null
  if (auth?.scope === 'roles' && operation['x-roles']?.length) return `Disponible para: ${operation['x-roles'].join(', ')}`
  if (auth?.scope === 'authenticated') return 'Disponible para: cualquier usuario autenticado'
  return auth?.description || 'Política de acceso no documentada'
}

export function schemaPresenter(document: () => OpenApiDocument | null) {
  function resolveSchema(schema?: OpenApiSchema): OpenApiSchema | undefined {
    if (!schema?.$ref) return schema
    const name = schema.$ref.split('/').at(-1)
    return name ? document()?.components?.schemas?.[name] : undefined
  }
  function schemaLabel(schema?: OpenApiSchema): string {
    if (!schema) return 'sin tipo especificado'
    if (schema.$ref) return `${schema.$ref.split('/').at(-1)}${schema.nullable ? ' | null' : ''}`
    const variants = schema.oneOf ?? schema.anyOf ?? schema.allOf
    const label = variants ? variants.map(schemaLabel).join(schema.allOf ? ' & ' : ' | ')
      : schema.enum?.length ? schema.enum.join(' | ')
        : schema.type === 'array' ? `${schemaLabel(schema.items)}[]`
          : schema.format ? `${schema.type ?? 'string'} (${schema.format})` : schema.type ?? (schema.properties ? 'object' : 'sin tipo especificado')
    return `${label}${schema.nullable ? ' | null' : ''}`
  }
  function exampleFromSchema(schema?: OpenApiSchema, visited = new Set<string>()): unknown {
    if (!schema) return undefined
    if (schema.example !== undefined) return schema.example
    if (schema.$ref) {
      if (visited.has(schema.$ref)) return null
      return exampleFromSchema(resolveSchema(schema), new Set([...visited, schema.$ref]))
    }
    if (schema.allOf?.length) return Object.assign({}, ...schema.allOf.map(part => exampleFromSchema(part, visited)))
    if (schema.oneOf?.length || schema.anyOf?.length) return exampleFromSchema((schema.oneOf ?? schema.anyOf)?.[0], visited)
    if (schema.enum?.length) return schema.enum[0]
    if (schema.type === 'array') return [exampleFromSchema(schema.items, visited) ?? null]
    if (schema.type === 'object' || schema.properties) return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([name, property]) => [name, exampleFromSchema(property, visited) ?? null]))
    if (schema.type === 'string') return schema.format === 'date-time' ? '2026-01-01T00:00:00.000Z' : schema.format === 'uuid' ? '00000000-0000-4000-8000-000000000000' : 'texto'
    if (schema.type === 'integer' || schema.type === 'number') return 0
    if (schema.type === 'boolean') return false
    return undefined
  }
  // Conserva toda la definición y expande referencias; los ciclos se mantienen como $ref.
  function schemaDefinition(schema?: OpenApiSchema, visited = new Set<string>()): unknown {
    if (!schema) return undefined
    if (schema.$ref && !visited.has(schema.$ref)) {
      const resolved = resolveSchema(schema)
      if (resolved) return { ...schema, definition: schemaDefinition(resolved, new Set([...visited, schema.$ref])) }
    }
    return Object.fromEntries(Object.entries(schema).map(([key, value]) => [key,
      key === 'properties' ? Object.fromEntries(Object.entries(schema.properties ?? {}).map(([name, property]) => [name, schemaDefinition(property, visited)]))
        : ['allOf', 'oneOf', 'anyOf'].includes(key) && Array.isArray(value) ? value.map(part => schemaDefinition(part, visited))
          : ['items', 'additionalProperties'].includes(key) && typeof value === 'object' && value !== null ? schemaDefinition(value, visited) : value,
    ]))
  }
  function mediaExamples(content?: Record<string, OpenApiMediaType>) {
    return Object.entries(content ?? {}).map(([mediaType, media]) => {
      const named = Object.values(media.examples ?? {}).find(example => example.value !== undefined)?.value
      const value = media.example !== undefined ? media.example : named !== undefined ? named : exampleFromSchema(media.schema)
      return { mediaType, body: value === undefined ? undefined : mediaType.includes('json') ? JSON.stringify(value, null, 2) : String(value), schema: media.schema ? JSON.stringify(schemaDefinition(media.schema), null, 2) : undefined }
    })
  }
  function responseExamples(operation: OpenApiOperation) {
    return Object.entries(operation.responses ?? {}).flatMap(([status, response]) => {
      const media = mediaExamples(response.content)
      return media.length ? media.map(entry => ({ status, description: response.description, ...entry, noBody: false }))
        : [{ status, description: response.description, mediaType: '', body: undefined, schema: undefined, noBody: true }]
    })
  }
  return { resolveSchema, schemaLabel, mediaExamples, responseExamples }
}
