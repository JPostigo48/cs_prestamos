import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadComponent } from './helpers/modules.mjs'
import { mount, find, event, text } from './helpers/renderer.mjs'

const api = JSON.parse(await readFile(new URL('../public/generated/project/openapi.json', import.meta.url)))
const backend = JSON.parse(await readFile(new URL('../../backend/openapi.json', import.meta.url)))
const Badge = await loadComponent('modules/project-showcase/components/AccessBadge')
const all = ['USUARIO', 'OPERADOR', 'ADMINISTRADOR']
const staff = ['OPERADOR', 'ADMINISTRADOR']
// Matriz de pruebas, no catálogo de producto: la UI consume únicamente OpenAPI oficial.
const cases = [
  ['post', '/auth/google/authorization', []],
  ['post', '/auth/google/authenticate', []],
  ['get', '/terms/current', []],
  ['post', '/auth/registration-requests', []],
  ['get', '/auth/accounts', ['ADMINISTRADOR'], ['userId']],
  ['get', '/inventory/resources/{resourceId}/accessories', all],
  ['put', '/inventory/resources/{resourceId}/accessories', ['ADMINISTRADOR']],
  ['patch', '/inventory/resources/{resourceId}/loan-policy', ['ADMINISTRADOR']],
  ['get', '/loans/resource/{resourceId}/history', staff, ['page', 'limit', 'status']],
  ['post', '/loans/{loanId}/return-checklist', staff],
  ['get', '/loans/reservations', null, ['page', 'limit', 'status', 'userId', 'copyId']],
  ['get', '/appeals', all, ['page', 'limit', 'status', 'userId', 'sanctionId']],
  ['get', '/sanctions/{sanctionId}', all],
  ['post', '/users/{userId}/suspensions', ['ADMINISTRADOR']],
  ['post', '/sanctions/{sanctionId}/lift', ['ADMINISTRADOR']],
]
function complete(schema, visited = new Set()) {
  assert.ok(schema, 'Falta esquema')
  if (schema.$ref) {
    assert.ok(schema.$ref.startsWith('#/components/schemas/'))
    if (visited.has(schema.$ref)) return
    return complete(api.components.schemas[schema.$ref.split('/').at(-1)], new Set([...visited, schema.$ref]))
  }
  const variants = schema.oneOf ?? schema.anyOf ?? schema.allOf
  if (variants) { variants.forEach(part => complete(part, visited)); return }
  assert.ok(schema.type || schema.properties, JSON.stringify(schema))
  if (schema.type === 'array') complete(schema.items, visited)
  if (schema.type === 'object' || schema.properties) {
    assert.ok(Object.keys(schema.properties ?? {}).length > 0, 'Objeto sin forma documentada')
    Object.values(schema.properties).forEach(part => complete(part, visited))
  }
}
test('copia Showcase idéntica al OpenAPI oficial', () => assert.deepEqual(api, backend))
for (const [method, path, roles, queries = []] of cases) {
  test(`${method.toUpperCase()} ${path}: respuesta completa, entradas, errores y acceso`, async () => {
    const operation = api.paths[path]?.[method]
    assert.ok(operation)
    assert.ok(operation.tags.length)
    assert.equal(operation['x-implementation-status'], 'implemented')
    const publicRoute = roles?.length === 0
    assert.equal(operation['x-authentication'].required, !publicRoute)
    assert.deepEqual(operation['x-roles'], roles ?? [])
    assert.equal(operation.security.length > 0, !publicRoute)
    const parameters = operation.parameters ?? []
    for (const name of queries) assert.ok(parameters.some(p => p.in === 'query' && p.name === name), name)
    for (const [, name] of path.matchAll(/\{([^}]+)\}/g)) {
      const parameter = parameters.find(p => p.in === 'path' && p.name === name)
      assert.equal(parameter?.schema.type, 'string')
      assert.equal(parameter?.schema.format, 'uuid')
    }
    if (method !== 'get') complete(operation.requestBody?.content['application/json'].schema)
    for (const [status, response] of Object.entries(operation.responses)) {
      assert.ok(response.description !== undefined)
      if (+status < 300 || +status >= 400) complete(response.content?.['application/json']?.schema)
    }
    assert.ok(operation.responses[500])
    if (!publicRoute) assert.ok(operation.responses[401])
    const view = mount(Badge, { operation })
    try {
      const button = find(view.root, 'button')
      if (publicRoute) { assert.equal(button, undefined); assert.match(text(view.root), /Público/) }
      else {
        assert.ok(button)
        await event(button, 'focus')
        for (const role of roles ?? []) assert.ok(text(view.root).includes(role))
        if (['/loans/reservations', '/appeals', '/sanctions/{sanctionId}'].includes(path)) assert.match(text(view.root), /solo .*propias/)
      }
    } finally { view.unmount() }
  })
}
