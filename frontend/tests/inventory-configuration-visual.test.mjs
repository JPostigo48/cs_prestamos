import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryHistory, createRouter } from 'vue-router'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model, text } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const Editor = await loadComponent('modules/inventory/components/ResourceEditorDialog')
const Detail = await loadComponent('modules/inventory/pages/ResourceDetailPage')
const category = { id: 'category', nombre: 'Categoría', tiempoMaximoPrestamoDias: 1, tiempoMaximoPrestamoHoras: 8 }
const resource = { id: 'resource', categoriaId: category.id, nombre: 'Artículo', descripcion: null, durationHours: 3 }
const policy = { resourceId: resource.id, categoryId: category.id, durationHours: 3, effectiveDurationHours: 3, source: 'RESOURCE' }
beforeEach(() => { testEnvironment(); auth.saveSession(session('ADMINISTRADOR')) })

test('editor: precarga, conserva ID al renombrar, guarda aparte y retira excepción con null', async () => {
  const calls = []
  let items = [{ id: 'accessory', nombre: 'Cargador' }], savedPolicy = { ...policy }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/copies')) return Response.json([])
    if (url.endsWith('/accessories')) {
      if (options.method === 'PUT') items = JSON.parse(options.body).items
      return Response.json({ items })
    }
    if (url.endsWith('/loan-policy')) {
      const { durationHours } = JSON.parse(options.body)
      savedPolicy = { ...policy, durationHours, effectiveDurationHours: durationHours ?? 8, source: durationHours === null ? 'CATEGORY' : 'RESOURCE' }
      return Response.json(savedPolicy)
    }
    return Response.json({ ...resource, loanPolicy: savedPolicy })
  }
  const app = mount(Editor, { resource, categories: [category] })
  try {
    await flush()
    await event(find(app.root, 'button', 'Accesorios'), 'click')
    const accessoryInput = findAll(app.root, node => node.tag === 'input' && node.value === 'Cargador')[0]
    assert.ok(accessoryInput)
    await model(accessoryInput, 'Adaptador')
    await event(find(app.root, 'form', 'Partes y accesorios'), 'submit')
    assert.deepEqual(JSON.parse(calls.find(call => call.options.method === 'PUT').options.body), { items: [{ id: 'accessory', nombre: 'Adaptador' }] })
    assert.match(text(app.root), /Accesorios confirmados/)
    await event(find(app.root, 'button', 'Duración'), 'click')
    await model(findAll(app.root, node => node.tag === 'input' && node.props.type === 'number')[0], '')
    await event(find(app.root, 'form', 'Duración del préstamo'), 'submit')
    assert.deepEqual(JSON.parse(calls.find(call => call.url.endsWith('/loan-policy')).options.body), { durationHours: null })
    assert.match(text(app.root), /Herencia de categoría confirmada/)
    assert.match(text(app.root), /Duración efectiva guardada: 8 horas/)
  } finally { app.unmount() }
})

test('editor: error de lectura bloquea reemplazo, ofrece reintento y nunca anuncia éxito', async () => {
  let failing = true
  const writes = []
  globalThis.fetch = async (url, options) => {
    if (options.method !== 'GET') writes.push(url)
    if (url.endsWith('/copies')) return Response.json([])
    if (url.endsWith('/accessories')) return failing ? Response.json({ message: 'Fallo de lectura' }, { status: 500 }) : Response.json({ items: [] })
    return Response.json({ ...resource, loanPolicy: policy })
  }
  const app = mount(Editor, { resource, categories: [category] })
  try {
    await flush()
    await event(find(app.root, 'button', 'Accesorios'), 'click')
    assert.equal(find(app.root, 'button', 'Confirmar reemplazo').props.disabled, true)
    assert.doesNotMatch(text(app.root), /Accesorios confirmados por el servidor/)
    failing = false
    await event(find(app.root, 'button', 'Volver a intentar'), 'click')
    await flush()
    assert.equal(find(app.root, 'button', 'Confirmar reemplazo').props.disabled, false)
    assert.deepEqual(writes, [])
  } finally { app.unmount() }
})

test('editor: operador puede leer, pero no tiene acciones de escritura de configuración', async () => {
  auth.saveSession(session('OPERADOR'))
  globalThis.fetch = async url => Response.json(url.endsWith('/copies') ? [] : url.endsWith('/accessories') ? { items: [] } : { ...resource, loanPolicy: policy })
  const app = mount(Editor, { resource, categories: [category] })
  try {
    await flush()
    const buttons = findAll(app.root, node => node.tag === 'button').map(text)
    assert.ok(!buttons.some(label => /Confirmar reemplazo|Guardar duración individual/.test(label)))
  } finally { app.unmount() }
})

test('detalle: duración efectiva y accesorios reales usan resourceId, con error y reintento propios', async () => {
  auth.saveSession(session('USUARIO'))
  let failing = true
  const calls = []
  globalThis.fetch = async url => {
    calls.push(url)
    if (url.endsWith('/copies')) return Response.json([])
    if (url.endsWith('/accessories')) return failing ? Response.json({}, { status: 500 }) : Response.json({ items: [{ id: 'accessory', nombre: 'Cargador confirmado' }] })
    return Response.json({ ...resource, categoria: category, loanPolicy: policy })
  }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/app/resources/:resourceId', component: { render: () => null } }] })
  await router.push('/app/resources/resource')
  const app = mount(Detail, {}, [router])
  try {
    await flush()
    assert.match(text(app.root), /Duración máxima: 3 horas/)
    assert.doesNotMatch(text(app.root), /Cargador confirmado/)
    failing = false
    await event(find(app.root, 'button', 'Volver a intentar'), 'click')
    await flush()
    assert.match(text(app.root), /Cargador confirmado/)
    assert.equal(calls.filter(url => url === '/api/inventory/resources/resource/accessories').length, 2)
    assert.ok(!calls.some(url => /history/.test(url)))
  } finally { app.unmount() }
})
