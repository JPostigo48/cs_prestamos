import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryHistory, createRouter } from 'vue-router'
import { load, loadComponent, session, testEnvironment } from './helpers/modules.mjs'
import { mount, flush, find, findAll, text, model, event } from './helpers/renderer.mjs'
import { compatibility, inventoryResource, inventoryCopy } from './helpers/inventory-compatibility-fixtures.mjs'

const api = await load('modules/inventory/api/inventory-api')
const contracts = await load('modules/inventory/api/compatibility-contracts')
const copies = await load('modules/inventory/api/copy-contracts')
const auth = await load('modules/auth/api/auth-api')
const categoriesApi = await load('modules/inventory/api/categories-api')
const Card = await loadComponent('modules/inventory/components/ResourceCard')
const Manager = await loadComponent('modules/inventory/components/CopyManager')
const Rehabilitate = await loadComponent('modules/inventory/components/RehabilitateCopyDialog')
const Detail = await loadComponent('modules/inventory/pages/ResourceDetailPage')
const Catalog = await loadComponent('modules/inventory/pages/CatalogPage')
const Categories = await loadComponent('modules/inventory/pages/CategoriesPage')
const Editor = await loadComponent('modules/inventory/components/ResourceEditorDialog')
const category = { id: 'cat1', nombre: 'Equipos', descripcion: null, activo: true, copyCount: 4, resourceCount: 1, tiempoMaximoPrestamoDias: 1, tiempoMaximoPrestamoHoras: 24 }
beforeEach(() => { testEnvironment(); auth.saveSession(session('ADMINISTRADOR')) })
const incompatible = error => error.status === 0
async function routerFor(path) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
  await router.push(path); await router.isReady(); return router
}

for (const capabilities of [{}, { physicalCondition: true }, { administrativeEnablement: true }, { physicalCondition: true, administrativeEnablement: true }]) {
  test(`esquema viejo/parcial ${JSON.stringify(capabilities)} preserva stock y desconocidos`, () => {
    const meta = compatibility(false, capabilities)
    const resource = api.parseResource(inventoryResource(false, { compatibility: meta }))
    assert.equal(resource.available, null); assert.equal(resource.availableCopies, null)
    assert.equal(resource.totalCopies, 4); assert.deepEqual(resource.registeredStock, { libres: 1, prestados: 1, retenidos: 1, reservados: 1 })
    const copy = copies.parseCopy(inventoryCopy(false, { compatibility: meta, condicionFisica: capabilities.physicalCondition ? 'DANADO' : null, habilitado: capabilities.administrativeEnablement ? false : null }))
    assert.equal(copy.estado, 'DISPONIBLE')
    assert.equal(copy.habilitado, capabilities.administrativeEnablement ? false : null)
    for (const action of ['create', 'activate', 'release', 'rehabilitate', 'manageCopy']) assert.equal(contracts.inventoryActionAllowed(meta, action), false)
    assert.equal(contracts.inventoryActionAllowed(meta, 'descriptiveEdits'), true)
  })
}
test('legacy: solo campos ausentes normalizan a null; nunca se infiere habilitación ni clasificación', () => {
  const copy = copies.parseCopy({ id: 'c1', recursoId: 'r1', codigoInventario: 'INV', estado: 'RESERVADO' })
  assert.equal(copy.condicionFisica, null); assert.equal(copy.habilitado, null); assert.equal(copy.compatibility, null)
  const resource = api.parseResource({ id: 'r1', categoriaId: 'cat1', nombre: 'Legacy' })
  for (const key of ['available', 'availableCopies', 'totalCopies', 'registeredStock', 'compatibility']) assert.equal(resource[key], null)
  assert.equal(contracts.inventoryActionAllowed(null, 'create'), false)
})
for (const bad of [null, undefined, {}, { ...compatibility(), status: 'UNKNOWN' }, { ...compatibility(), message: false },
  { ...compatibility(), actions: {} }, { ...compatibility(), capabilities: {} },
  { ...compatibility(false), actions: compatibility().actions }, { ...compatibility(), capabilities: compatibility(false).capabilities },
  { ...compatibility(false), message: null }]) {
  test(`metadatos nuevos inválidos no hacen fallback: ${JSON.stringify(bad)}`, () => {
    assert.throws(() => api.parseResource(inventoryResource(true, { compatibility: bad })), incompatible)
    assert.equal(copies.validCopy(inventoryCopy(true, { compatibility: bad })), false)
  })
}
for (const [key, bad] of [['registeredStock', null], ['registeredStock', { libres: -1, prestados: 1, retenidos: 1, reservados: 1 }],
  ['totalCopies', null], ['totalCopies', 99], ['availableCopies', undefined], ['availableCopies', -1], ['availableCopies', 1.5], ['availableCopies', 3], ['availableCopies', 5], ['available', 'true']]) {
  test(`stock/disponibilidad nuevos estrictos ${key}=${JSON.stringify(bad)}`, () => assert.throws(() => api.parseResource(inventoryResource(true, { [key]: bad })), incompatible))
}
for (const key of ['condicionFisica', 'habilitado', 'registeredStock', 'availableCopies']) test(`contrato nuevo no tolera omisión de ${key}`, () => {
  const row = key === 'habilitado' || key === 'condicionFisica' ? inventoryCopy() : inventoryResource()
  delete row[key]
  assert.throws(() => key === 'habilitado' || key === 'condicionFisica' ? copies.parseCopy(row) : api.parseResource(row), incompatible)
})
test('cero verificable no clasifica ejemplares como dañados; cero stock pendiente no inventa cero disponibilidad', () => {
  const resource = api.parseResource(inventoryResource(true, { available: false, availableCopies: 0 }))
  assert.equal(resource.availableCopies, 0)
  assert.equal(copies.parseCopy(inventoryCopy(true, { condicionFisica: null })).condicionFisica, null)
  const empty = api.parseResource(inventoryResource(false, { totalCopies: 0, registeredStock: { libres: 0, prestados: 0, retenidos: 0, reservados: 0 } }))
  assert.equal(empty.availableCopies, null)
  assert.throws(() => api.parseResource(inventoryResource(false, { availableCopies: 0 })), incompatible)
})
test('agregación: una disponibilidad desconocida hace desconocida su categoría, sin afectar otras', () => {
  const rows = [inventoryResource(), inventoryResource(false), inventoryResource(true, { categoriaId: 'cat2', availableCopies: 2 })]
  assert.equal(api.categoryAvailability(rows, 'cat1'), null)
  assert.equal(api.categoryAvailability(rows, 'cat2'), 2)
  assert.equal(api.categoryAvailability(null, 'cat1'), null)
})
test('disponibilidad individual y global: rutas reales, reservado incluido y null preservado', async () => {
  const resource = inventoryResource(false)
  const counts = { available: null, totalCopies: 4, disponibles: null, noDisponibles: null, prestados: 1, reservados: 1, registeredStock: resource.registeredStock, compatibility: resource.compatibility }
  globalThis.fetch = async url => url === '/api/inventory/availability' ? Response.json([{ ...resource, ...counts }]) : (assert.equal(url, '/api/inventory/resources/r%2F1/availability'), Response.json({ resourceId: 'r/1', ...counts }))
  assert.equal((await api.getResourceAvailability('r/1')).reservados, 1)
  const rows = await api.getGlobalAvailability()
  assert.equal(rows[0].availableCopies, null); assert.equal(rows[0].totalCopies, 4)
  globalThis.fetch = async () => Response.json([{ ...resource, ...counts, reservados: '1' }])
  await assert.rejects(api.getGlobalAvailability(), incompatible)
})
test('catálogo vacío conserva compatibilidad raíz; metadatos inválidos fallan incluso sin filas', async () => {
  globalThis.fetch = async url => { assert.match(url, /page=1&limit=1/); return Response.json({ data: [], total: 0, page: 1, limit: 1, compatibility: compatibility(false) }) }
  assert.equal((await api.getInventoryCompatibility()).status, 'UPDATE_PENDING')
  globalThis.fetch = async () => Response.json({ data: [], total: 0, page: 1, limit: 1, compatibility: {} })
  await assert.rejects(api.getInventoryCompatibility(), incompatible)
})
test('paginación legacy incompleta no inventa total cero; paginación nueva incompleta se rechaza', async () => {
  const filters = { search: '', categoryId: '', available: '', page: 2, limit: 10 }
  globalThis.fetch = async () => Response.json({ data: [] })
  const result = await api.getResources(filters)
  assert.equal(result.total, null); assert.equal(result.page, 2); assert.equal(result.limit, 10)
  globalThis.fetch = async () => Response.json({ data: [], compatibility: compatibility() })
  await assert.rejects(api.getResources(filters), incompatible)
})
for (const status of [403, 503]) test(`errores HTTP ${status} no se convierten en stock cero ni listas vacías`, async () => {
  globalThis.fetch = async () => Response.json({ message: 'No disponible', code: 'SCHEMA_CAPABILITY_UNAVAILABLE' }, { status })
  await assert.rejects(api.getCopies('r1'), e => e.status === status)
  await assert.rejects(api.getGlobalAvailability(), e => e.status === status)
  await assert.rejects(api.getInventoryCompatibility(), e => e.status === status)
})
test('edición descriptiva de recurso y categoría no envía categoría, estado ni duración', async () => {
  const bodies = []
  globalThis.fetch = async (url, options) => { bodies.push(JSON.parse(options.body)); return Response.json(url.includes('/categories/') ? category : inventoryResource(false)) }
  await api.saveResource('r1', { nombre: 'Multímetro', categoriaId: 'cat1', descripcion: null }, { descriptiveOnly: true })
  await categoriesApi.saveCategory('cat1', category, { descriptiveOnly: true })
  assert.deepEqual(bodies, [{ nombre: 'Multímetro', descripcion: null }, { nombre: 'Equipos', descripcion: null }])
})
test('revalidación remota pendiente impide PATCH físico aunque la fila local diga READY', async () => {
  let patches = 0
  globalThis.fetch = async (_url, options) => { if (options.method === 'PATCH') patches++; return Response.json(inventoryCopy(false)) }
  await assert.rejects(api.changeCopyState(inventoryCopy(), 'NO_DISPONIBLE'), e => e.status === 503)
  assert.equal(patches, 0)
})
test('READY no reemplaza ocupación ni verificación explícita', async () => {
  let patches = 0
  globalThis.fetch = async (_url, options) => { if (options.method === 'PATCH') patches++; return Response.json(inventoryCopy(true, { estado: 'NO_DISPONIBLE' })) }
  await assert.rejects(api.changeCopyState(inventoryCopy(true, { estado: 'PRESTADO' }), 'NO_DISPONIBLE'), e => e.status === 409)
  await assert.rejects(api.changeCopyState(inventoryCopy(true, { estado: 'NO_DISPONIBLE' }), 'DISPONIBLE'), e => e.status === 400)
  assert.equal(patches, 0)
})
test('predicado para préstamos exige todos los prerrequisitos, sin inferirlos de la ocupación', () => {
  assert.equal(copies.isCopyEligibleForLoan(inventoryCopy()), true)
  for (const extra of [{ condicionFisica: null }, { condicionFisica: 'DANADO' }, { habilitado: null }, { habilitado: false }, { estado: 'RESERVADO' }, { estado: 'PRESTADO' }, { estado: 'NO_DISPONIBLE' }, { compatibility: null }, { compatibility: compatibility(false) }])
    assert.equal(copies.isCopyEligibleForLoan(inventoryCopy(true, extra)), false, JSON.stringify(extra))
})
test('READY: retención y rehabilitación explícita siguen enviando el contrato físico y conservan evidencia vacía', async () => {
  const bodies = []
  let current = inventoryCopy()
  globalThis.fetch = async (_url, options) => {
    if (options.method !== 'PATCH') return Response.json(current)
    const body = JSON.parse(options.body); bodies.push(body)
    current = { ...current, estado: body.estado }
    return Response.json(current)
  }
  await api.changeCopyState(current, 'NO_DISPONIBLE')
  const verification = { fitForLoan: true, componentsComplete: true, reason: 'Verificado', evidenceIds: [] }
  await api.changeCopyState(current, 'DISPONIBLE', verification)
  assert.deepEqual(bodies, [{ estado: 'NO_DISPONIBLE' }, { estado: 'DISPONIBLE', verification }])
})
test('lecturas de ejemplares conservan null, detectan identidad ajena y no aceptan metadatos corruptos', async () => {
  globalThis.fetch = async () => Response.json([inventoryCopy(false)])
  const rows = await api.getCopies('r1')
  assert.equal(rows[0].habilitado, null); assert.equal(rows[0].condicionFisica, null)
  await assert.rejects(api.getCopies('otra'), incompatible)
  globalThis.fetch = async () => Response.json(inventoryCopy(false, { id: 'otra' }))
  await assert.rejects(api.getCopy('c1'), incompatible)
  globalThis.fetch = async () => Response.json([inventoryCopy(false, { compatibility: null })])
  await assert.rejects(api.getCopies('r1'), incompatible)
})
test('render gestor READY: altas y retención permitidas, ocupados sin acciones físicas', async () => {
  globalThis.fetch = async () => Response.json([inventoryCopy(), inventoryCopy(true, { id: 'c2', estado: 'RESERVADO' })])
  const view = mount(Manager, { resourceId: 'r1', compatibility: compatibility() })
  try {
    await flush(); await model(find(view.root, 'input'), 'NUEVO')
    assert.equal(find(view.root, 'button', 'Retener').props.disabled, false)
    assert.equal(find(view.root, 'button', 'Añadir ejemplar').props.disabled, false)
    assert.equal(findAll(view.root, n => n.tag === 'button' && text(n).includes('Retener')).length, 1)
    assert.doesNotMatch(text(view.root), /Actualización de inventario pendiente/)
  } finally { view.unmount() }
})
test('render editor pendiente permite descripción sin enviar reasignación ni operaciones físicas', async () => {
  let body
  const resource = inventoryResource(false, { categoria: category, loanPolicy: { durationHours: null, effectiveDurationHours: 24, source: 'CATEGORY' } })
  globalThis.fetch = async (url, options) => {
    if (options.method === 'PATCH') { body = JSON.parse(options.body); return Response.json({ ...resource, ...body }) }
    if (url.endsWith('/accessories')) return Response.json({ items: [] })
    if (url.endsWith('/copies')) return Response.json([])
    return Response.json(resource)
  }
  const view = mount(Editor, { resource, categories: [category], compatibility: compatibility(false) })
  try {
    await flush(); await flush()
    assert.equal(find(view.root, 'select').props.disabled, true)
    const name = findAll(view.root, n => n.tag === 'input')[0]
    await model(name, 'Nombre actualizado')
    await event(find(view.root, 'form'), 'submit')
    assert.deepEqual(body, { nombre: 'Nombre actualizado', descripcion: null })
    assert.match(text(view.root), /Datos básicos confirmados/)
  } finally { view.unmount() }
})
test('render tarjeta: desconocido y stock real, nunca «0 disponibles» por null', async () => {
  const router = await routerFor('/app/catalog')
  const view = mount(Card, { resource: inventoryResource(false), management: true }, [router])
  try { assert.match(text(view.root), /Desconocida|desconocida/); assert.match(text(view.root), /Stock registrado: 4/); assert.match(text(view.root), /Actualización de inventario pendiente/); assert.doesNotMatch(text(view.root), /0 disponibles/) }
  finally { view.unmount() }
})
test('render catálogo vacío pendiente: aviso visible y creación deshabilitada, filtros intactos', async () => {
  globalThis.fetch = async url => Response.json(url.includes('/categories') ? [] : { data: [], total: 0, page: 1, limit: 20, compatibility: compatibility(false) })
  const router = await routerFor('/app/admin/inventory')
  const view = mount(Catalog, { management: true }, [router])
  try {
    await flush(); await flush()
    assert.match(text(view.root), /Actualización de inventario pendiente/)
    assert.match(text(view.root), /No hay recursos/)
    assert.equal(find(view.root, 'button', 'Nuevo recurso').props.disabled, true)
    assert.equal(find(view.root, 'button', 'Buscar').props.disabled, undefined)
    await event(find(view.root, 'button', 'Nuevo recurso'), 'click')
    assert.equal(find(view.root, 'dialog'), undefined)
  } finally { view.unmount() }
})
test('render gestor parcial: habilitación false distinta de null, retención/rehabilitación/alta bloqueadas', async () => {
  const partial = compatibility(false, { administrativeEnablement: true })
  globalThis.fetch = async () => Response.json([inventoryCopy(false, { habilitado: false, compatibility: partial }), inventoryCopy(false, { id: 'c2', estado: 'NO_DISPONIBLE' })])
  const view = mount(Manager, { resourceId: 'r1', compatibility: partial })
  try {
    await flush(); await flush(); await model(find(view.root, 'input'), 'NUEVO')
    assert.match(text(view.root), /Deshabilitado administrativamente/); assert.match(text(view.root), /Habilitación administrativa desconocida/)
    assert.equal(find(view.root, 'button', 'Retener').props.disabled, true)
    assert.equal(find(view.root, 'button', 'Verificar rehabilitación').props.disabled, true)
    assert.equal(find(view.root, 'button', 'Añadir ejemplar').props.disabled, true)
    await event(find(view.root, 'button', 'Retener'), 'click')
    assert.equal(find(view.root, 'button', 'Confirmar cambio'), undefined)
  } finally { view.unmount() }
})
test('render rehabilitación pendiente: aviso y controles deshabilitados, sin consultar evidencias', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('No debe consultar') }
  const view = mount(Rehabilitate, { copy: inventoryCopy(false, { estado: 'NO_DISPONIBLE' }) })
  try { await flush(); assert.match(text(view.root), /Actualización de inventario pendiente/); assert.equal(find(view.root, 'button', 'Confirmar rehabilitación').props.disabled, true); assert.equal(find(view.root, 'fieldset').props.disabled, true); assert.equal(calls, 0) }
  finally { view.unmount() }
})
test('render categorías con catálogo vacío: aviso, alta y activación bloqueadas; edición/desactivación conservadas', async () => {
  globalThis.fetch = async url => Response.json(url.includes('/categories') ? [category, { ...category, id: 'cat2', activo: false }] : { data: [], total: 0, page: 1, limit: 1, compatibility: compatibility(false) })
  const view = mount(Categories)
  try { await flush(); await flush(); assert.match(text(view.root), /Actualización de inventario pendiente/); assert.equal(find(view.root, 'button', 'Nueva categoría').props.disabled, true); assert.equal(find(view.root, 'button', 'Activar').props.disabled, true); assert.equal(find(view.root, 'button', 'Desactivar').props.disabled, false); assert.equal(find(view.root, 'button', 'Editar').props.disabled, false) }
  finally { view.unmount() }
})
for (const state of ['pending', 'zero', 'available']) test(`render detalle ${state} usa disponibilidad elegible, no cantidad libre`, async () => {
  const ready = state !== 'pending'
  auth.saveSession(session('USUARIO'))
  const resource = inventoryResource(ready, { available: ready ? state === 'available' : null, availableCopies: ready ? state === 'available' ? 1 : 0 : null,
    categoria: category, loanPolicy: { effectiveDurationHours: 24, source: 'CATEGORY' } })
  globalThis.fetch = async url => {
    if (url.endsWith('/copies')) return Response.json([inventoryCopy(ready)])
    if (url.endsWith('/accessories')) return Response.json({ items: [] })
    if (url.includes('/reservations?')) return Response.json({ items: [], total: 0, page: 1, limit: 1 })
    if (url.includes('/history')) return Response.json([])
    if (url.endsWith('/resources/r1')) return Response.json(resource)
    throw new Error('URL inesperada: ' + url)
  }
  const router = await routerFor('/app/resources/r1')
  // La página real usa params.resourceId.
  router.addRoute({ path: '/detail/:resourceId', component: Detail }); await router.push('/detail/r1')
  const view = mount(Detail, {}, [router])
  try {
    await flush(); await flush()
    assert.match(text(view.root), /Stock registrado: 4/)
    assert.equal(find(view.root, 'button', 'Reservar ejemplar').props.disabled, state !== 'available')
    if (!ready) { assert.match(text(view.root), /Disponibilidad desconocida/); assert.doesNotMatch(text(view.root), /0 disponibles/) }
    else { assert.equal(text(find(view.root, 'strong', state === 'available' ? '1' : '0')), state === 'available' ? '1' : '0'); assert.doesNotMatch(text(view.root), /Actualización de inventario pendiente/) }
  } finally { view.unmount() }
})
