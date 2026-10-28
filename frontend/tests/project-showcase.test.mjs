import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMemoryHistory, createRouter } from 'vue-router'
import { parseContract } from '../../scripts/project-db.mjs'
import { load, loadComponent } from './helpers/modules.mjs'
import { event, find, findAll, flush, model, mount, text } from './helpers/renderer.mjs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const contract = read('../../backend/prisma/contract.prisma')
const database = parseContract(contract)
const api = JSON.parse(read('../public/generated/project/openapi.json'))
const { accessDescription, schemaPresenter } = await load('modules/project-showcase/services/openApiPresentation')
const Badge = await loadComponent('modules/project-showcase/components/AccessBadge')
const ApiPage = await loadComponent('modules/project-showcase/pages/ProjectApiPage')
const DbPage = await loadComponent('modules/project-showcase/pages/ProjectDbPage')
const Layout = await loadComponent('modules/project-showcase/ProjectLayout')

test('contrato real completo: nombres, conteos, cada campo/tipo/atributo y cada relación', () => {
  const blocks = [...contract.matchAll(/^(model|enum) (\w+) \{\r?\n([\s\S]*?)^\}/gm)]
  assert.equal(database.models.length, 19)
  assert.equal(database.enums.length, 10)
  for (const kind of ['model', 'enum']) assert.deepEqual(database[kind === 'model' ? 'models' : 'enums'].map(item => item.name), blocks.filter(block => block[1] === kind).map(block => block[2]))
  for (const [, kind, name, body] of blocks) {
    const entity = database[kind === 'model' ? 'models' : 'enums'].find(item => item.name === name)
    assert.deepEqual(entity.attributes.map(item => item.raw), body.split(/\r?\n/).map(line => line.trim()).filter(line => line.startsWith('@@')))
    if (kind === 'enum') {
      assert.deepEqual(entity.values.map(item => item.name), body.split(/\r?\n/).map(line => line.trim()).filter(line => /^\w+$/.test(line)))
      continue
    }
    const fields = [...body.matchAll(/^\s+(\w+)\s+([\w.]+(?:\([^)]*\))?)(\?|\[\])?([^\r\n]*)/gm)]
    assert.equal(entity.fields.length, fields.length, name)
    for (const [index, [, fieldName, type, modifier, tail]] of fields.entries()) {
      const field = entity.fields[index]
      assert.equal(field.name, fieldName)
      assert.equal(field.typeExpression, type)
      assert.equal(field.nullable, modifier === '?')
      assert.equal(field.list, modifier === '[]')
      assert.equal(field.attributes.map(item => item.raw).join(' '), tail.trim())
      if (database.models.some(item => item.name === field.type)) {
        const relation = database.relations.find(item => item.source === name && item.field === fieldName)
        assert.ok(relation, `${name}.${fieldName}`)
        assert.equal(relation.target, field.type)
        assert.equal(relation.targetCardinality, modifier === '[]' ? '0..n' : modifier === '?' ? '0..1' : '1')
        const inverse = database.relations.find(item => item.source === relation.target && item.field === relation.inverse)
        assert.equal(inverse.target, name)
        assert.equal(inverse.inverse, fieldName)
        assert.equal(inverse.sourceCardinality, relation.targetCardinality)
        assert.equal(inverse.direction === 'outgoing', relation.direction === 'incoming')
        const owned = tail.match(/fields:\[([^\]]+)\], references:\[([^\]]+)\]/)
        if (owned) {
          assert.equal(relation.direction, 'outgoing')
          assert.deepEqual(relation.fields, owned[1].split(',').map(value => value.trim()))
          assert.deepEqual(relation.references, owned[2].split(',').map(value => value.trim()))
          assert.equal(relation.onDelete, tail.match(/onDelete: (\w+)/)[1])
          assert.equal(relation.onUpdate, tail.match(/onUpdate: (\w+)/)[1])
        }
      }
    }
  }
  assert.equal(database.relations.length, database.models.flatMap(item => item.fields).filter(field => field.kind === 'relation').length)
  assert.deepEqual(JSON.parse(read('../public/generated/project/db.json')), database)
})

test('fixtures Prisma Next: compuestos, listas, multiline, escapes, funciones, enums y mapeos', () => {
  const fixture = `// MÓDULO UNO
  model Parent {
    id Uuid @id @default(uuid())
    children Child[] @relation("Tree")
    @@map("parent")
  }
  /* comentario */ model Child {
    parentId Uuid
    seq Int
    amount Numeric(5, 2)? @default(0)
    tags String[] @default(["a,b", "//no comentario"])
    changed temporal.updatedAt()
    state State @default(ON)
    parent Parent @relation(
      "Tree", fields: [parentId], references: [id],
      onDelete: Cascade, onUpdate: Restrict
    )
    @@id([parentId, seq])
    @@unique([parentId, seq], name: "compound")
    @@index([seq])
    @@check(expression: "seq >= 0", name: "positive")
  }
  enum State {
    @@type("pg/text@1")
    ON @map("on")
    OFF
  }`
  const parsed = parseContract(fixture)
  assert.equal(parsed.models[0].module, 'MÓDULO UNO')
  assert.equal(parsed.models[1].fields[2].typeExpression, 'Numeric(5, 2)')
  assert.equal(parsed.models[1].fields[3].attributes[0].positional[0][1], '//no comentario')
  assert.equal(parsed.models[1].fields[4].typeExpression, 'temporal.updatedAt()')
  assert.equal(parsed.enums[0].values[0].attributes[0].positional[0], 'on')
  assert.equal(parsed.relations[0].direction, 'incoming')
  assert.equal(parsed.relations[1].direction, 'outgoing')
  assert.equal(parsed.relations[1].onDelete, 'Cascade')
  for (const unsupported of ['datasource db { provider = "postgres" }', 'model X { id Mystery }', 'model X { id Uuid @surprise }', 'model X { id Uuid @@index([missing]) }', 'model X { id Uuid', 'model X { id Uuid /*', 'model X { id Uuid @default("unterminated) }', 'model X { other X }']) assert.throws(() => parseContract(unsupported), /Contrato ORM, línea/)
})

test('metadata generada: público, autenticado sin roles, restringido y guard personalizado', () => {
  const operations = Object.values(api.paths).flatMap(path => Object.values(path))
  assert.equal(operations.length, 61)
  for (const path of ['/terms/current', '/terms/versions/{versionId}']) {
    assert.equal(api.paths[path].get['x-authentication'].scope, 'public')
    assert.equal(api.paths[path].get.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/PublicTermsResponseDto')
  }
  for (const operation of operations) {
    const auth = operation['x-authentication']
    const description = accessDescription(operation)
    if (auth.scope === 'public') assert.equal(description, null)
    else if (auth.scope === 'roles') assert.equal(description, `Disponible para: ${operation['x-roles'].join(', ')}`)
    else if (auth.scope === 'authenticated') assert.equal(description, 'Disponible para: cualquier usuario autenticado')
  }
  assert.equal(accessDescription({ 'x-roles': [], 'x-authentication': { scope: 'authenticated', required: true } }), 'Disponible para: cualquier usuario autenticado')
  assert.equal(accessDescription({ 'x-authentication': { scope: 'custom-guards', description: 'Guard propio' } }), 'Guard propio')
})

test('todas las respuestas: refs, anidados, arrays, escalares, composición, ciclos y sin cuerpo', () => {
  const presenter = schemaPresenter(() => api)
  for (const operation of Object.values(api.paths).flatMap(path => Object.values(path))) {
    const responses = presenter.responseExamples(operation)
    assert.deepEqual([...new Set(responses.map(item => item.status))], Object.keys(operation.responses))
    for (const response of responses) {
      if (response.noBody) assert.equal(response.body, undefined)
      else { assert.ok(response.schema); assert.notEqual(response.body, undefined, operation.operationId) }
    }
  }
  const document = { components: { schemas: { Node: { type: 'object', properties: { next: { $ref: '#/components/schemas/Node' }, nested: { type: 'array', items: { type: 'integer' } }, choice: { oneOf: [{ type: 'boolean' }, { type: 'string' }] } } } } } }
  const fixture = schemaPresenter(() => document).responseExamples({ responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } }, 'text/plain': { schema: { type: 'string' } } } }, 204: { description: 'Sin contenido' } } })
  assert.equal(fixture.length, 3)
  assert.deepEqual(JSON.parse(fixture[0].body), { next: null, nested: [0], choice: false })
  assert.ok(fixture[0].schema.includes('definition'))
  assert.equal(fixture[2].noBody, true)
})

test('candado montado: hover, foco, Escape, click táctil y público sin botón', async () => {
  const operation = { 'x-roles': ['OPERADOR', 'ADMINISTRADOR'], 'x-authentication': { required: true, scope: 'roles', description: 'Control adicional' } }
  const view = mount(Badge, { operation })
  const button = find(view.root, 'button')
  const wrapper = button.parent
  assert.equal(button.props['aria-expanded'], false)
  await event(wrapper, 'mouseenter')
  assert.ok(findAll(view.root, node => node.props.role === 'tooltip').length)
  assert.equal(button.props['aria-describedby'], findAll(view.root, node => node.props.role === 'tooltip')[0].props.id)
  await event(wrapper, 'mouseleave')
  assert.equal(button.props['aria-expanded'], false)
  await event(button, 'focus')
  await event(wrapper, 'keydown', { key: 'Escape' })
  assert.equal(button.props['aria-expanded'], false)
  await event(button, 'click')
  assert.equal(button.props['aria-expanded'], true)
  await event(button, 'click')
  assert.equal(button.props['aria-expanded'], false)
  await event(button, 'blur')
  view.unmount()
  const publicView = mount(Badge, { operation: { 'x-authentication': { scope: 'public' } } })
  assert.equal(find(publicView.root, 'button'), undefined)
  assert.ok(text(publicView.root).includes('Público'))
  publicView.unmount()
})

test('páginas montadas: 61 operaciones, DB completa, búsqueda, sin resultados y fallo de carga', async () => {
  globalThis.fetch = async url => ({ ok: true, json: async () => String(url).endsWith('db.json') ? database : api })
  const apiView = mount(ApiPage)
  await flush()
  assert.equal(findAll(apiView.root, node => node.tag === 'code' && /^\//.test(text(node))).length, 61)
  assert.ok(text(apiView.root).includes('/terms/current'))
  assert.ok(text(apiView.root).includes('/terms/versions/{versionId}'))
  assert.ok(!text(apiView.root).includes('forma de la respuesta aún'))
  apiView.unmount()
  const dbView = mount(DbPage)
  await flush()
  assert.equal(findAll(dbView.root, node => node.tag === 'h3').length, 29)
  await model(find(dbView.root, 'input'), 'CuentaAcceso')
  assert.equal(findAll(dbView.root, node => node.tag === 'h3').length, 1)
  assert.ok(text(dbView.root).includes('passwordHash')) // Solo nombre/tipo, nunca un valor.
  await model(find(dbView.root, 'input'), 'ninguno-xyz')
  assert.ok(text(dbView.root).includes('No hay modelos ni enums'))
  dbView.unmount()
  globalThis.fetch = async () => { throw new Error('offline') }
  const offline = mount(DbPage)
  await flush()
  assert.ok(text(offline.root).includes('Contrato ORM no disponible'))
  offline.unmount()
})

test('layout compila y monta con navegación DB junto a API', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/project/:page?', component: { render: () => null } }, { path: '/prototype', component: { render: () => null } }] })
  await router.push('/project/db')
  const view = mount(Layout, {}, [router])
  await flush()
  const links = findAll(view.root, node => node.tag === 'a')
  const apiIndex = links.findIndex(node => node.props.href === '/project/api')
  assert.equal(links[apiIndex + 1].props.href, '/project/db')
  assert.equal(links[apiIndex + 2].props.href, '/project/terms')
  assert.equal(text(links[apiIndex + 2]), 'T&C')
  assert.ok(find(view.root, 'header'))
  view.unmount()
})
