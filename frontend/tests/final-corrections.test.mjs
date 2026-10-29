import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryHistory, createRouter } from 'vue-router'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, text, event, model } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const inventory = await load('modules/inventory/api/inventory-api')
const guard = await load('shared/api/mutation-guard')
const query = await load('modules/inventory/catalog-query')
beforeEach(() => { testEnvironment(); auth.saveSession(session('ADMINISTRADOR')) })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
async function routerAt(path = '/app') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
  await router.push(path); await router.isReady(); return router
}
const category = { id: 'cat-final', nombre: 'Categoría real de nombre muy largo', resourceCount: 2, tiempoMaximoPrestamoHoras: 48, tiempoMaximoPrestamoDias: 2 }
const a = { nombre: 'Original A final', categoriaId: category.id, descripcion: 'Descripción A' }

test('R1: editor recupera A, confirma renombre B y Nuevo A crea otro ID y asigna allí los ejemplares', async () => {
  const component = await loadComponent('modules/inventory/components/ResourceEditorDialog')
  globalThis.fetch = async () => { throw new TypeError('resultado incierto') }
  await assert.rejects(inventory.saveResource(null, a))
  assert.equal(guard.pendingMutation(inventory.resourceIntent(a)), true)
  globalThis.fetch = async () => Response.json({ data: [{ ...a, id: 'old-A' }], total: 1 })
  await inventory.getResources(query.catalogFilters({}))
  const calls = []
  globalThis.fetch = async (url, options) => {
    const method = options.method ?? 'GET'; calls.push([url, method])
    if (url.endsWith('/copies')) {
      if (method === 'POST') return Response.json({ id: 'new-copy', recursoId: 'new-A', codigoInventario: 'CODE-A' })
      return Response.json([])
    }
    if (method === 'PATCH') return Response.json({ ...a, nombre: 'Renombrado B', id: 'old-A' })
    if (method === 'POST') return Response.json({ ...a, id: 'new-A' })
    return Response.json({ ...a, id: 'old-A' })
  }
  async function fillEditor(mounted, name = a.nombre) {
    await model(find(mounted.root, 'input'), name)
    await model(find(mounted.root, 'textarea'), a.descripcion)
    await model(find(mounted.root, 'select'), a.categoriaId)
    await event(find(mounted.root, 'form'), 'submit'); await flush()
  }
  const recovered = mount(component, { resource: null, categories: [category] })
  try {
    await fillEditor(recovered)
    assert.match(text(recovered.root), /Datos básicos confirmados/)
    assert.ok(calls.some(([url, method]) => url.endsWith('/old-A') && method === 'GET'))
    assert.equal(calls.filter(([, method]) => method === 'POST').length, 0)
    await model(find(recovered.root, 'input'), 'Renombrado B')
    await event(find(recovered.root, 'form'), 'submit')
  } finally { recovered.unmount(); await flush() }
  const fresh = mount(component, { resource: null, categories: [category] })
  try {
    await fillEditor(fresh)
    assert.equal(calls.filter(([url, method]) => url === '/api/inventory/resources' && method === 'POST').length, 1)
    // El CopyManager montado debe consultar y enviar al ID de la nueva alta, no al renombrado B.
    assert.ok(calls.some(([url]) => url.endsWith('/new-A/copies')))
    const copyForm = findAll(fresh.root, n => n.tag === 'form' && text(n).includes('ejemplar')).find(n => n !== find(fresh.root, 'form'))
    await model(find(copyForm, 'input'), 'CODE-A')
    await event(copyForm, 'submit')
    assert.ok(calls.some(([url, method]) => url.endsWith('/new-A/copies') && method === 'POST'))
    assert.equal(calls.some(([url, method]) => url.endsWith('/old-A/copies') && method === 'POST'), false)
  } finally { fresh.unmount(); await flush() }
})

test('R1: una recuperación se revalida; cambio remoto o fallo de lectura nunca envían POST alternativo', async () => {
  const body = { ...a, nombre: 'Revalidación remota final' }
  globalThis.fetch = async () => { throw new TypeError('offline') }
  await assert.rejects(inventory.saveResource(null, body))
  globalThis.fetch = async () => Response.json({ data: [{ ...body, id: 'remote-A' }], total: 1 })
  await inventory.getResources(query.catalogFilters({}))
  let writes = 0
  globalThis.fetch = async (_url, options) => { if (options.method && options.method !== 'GET') writes++; return Response.json({ ...body, nombre: 'Otra intención', id: 'remote-A' }) }
  await assert.rejects(inventory.saveResource(null, body), e => e.status === 409)
  globalThis.fetch = async (_url, options) => { if (options.method && options.method !== 'GET') writes++; throw new TypeError('offline') }
  await assert.rejects(inventory.saveResource(null, body))
  assert.equal(writes, 0)
})

test('R1: editar un ID invalida también recuperaciones aún no consumidas', async () => {
  const body = { ...a, nombre: 'Recuperación sin consumir' }
  globalThis.fetch = async () => { throw new TypeError('offline') }
  await assert.rejects(inventory.saveResource(null, body))
  globalThis.fetch = async () => Response.json({ data: [{ ...body, id: 'unconsumed-A' }], total: 1 })
  await inventory.getResources(query.catalogFilters({}))
  globalThis.fetch = async () => Response.json({ ...body, nombre: 'Ahora B', id: 'unconsumed-A' })
  await inventory.saveResource('unconsumed-A', { ...body, nombre: 'Ahora B' })
  globalThis.fetch = async (url, options) => { assert.equal(options.method, 'POST'); assert.equal(url, '/api/inventory/resources'); return Response.json({ ...body, id: 'new-unconsumed-A' }) }
  assert.equal((await inventory.saveResource(null, body)).id, 'new-unconsumed-A')
})

test('R2: pestañas controlan el DOM estable y conservan lectura F14 pendiente sin GET automáticos', async () => {
  const component = await loadComponent('modules/loans/pages/LoanOperationsPage')
  const pending = deferred(); let reads = 0
  globalThis.fetch = async url => {
    if (url.includes('/reservations')) { reads++; return pending.promise }
    return Response.json([])
  }
  const mounted = mount(component)
  try {
    await flush()
    const wrapper = findAll(mounted.root, n => n.props['data-reservations-panel'] !== undefined)[0]
    assert.equal(wrapper.style.display, 'none'); assert.equal(reads, 0)
    await event(find(mounted.root, 'button', 'Entregas de reservas'), 'click')
    assert.notEqual(wrapper.style.display, 'none'); assert.equal(reads, 0)
    const reading = event(find(wrapper, 'button', 'Consultar / actualizar reservas'), 'click')
    await flush(); assert.equal(reads, 1)
    await event(find(mounted.root, 'button', 'En mora'), 'click')
    assert.equal(wrapper.style.display, 'none')
    await event(find(mounted.root, 'button', 'Entregas de reservas'), 'click')
    assert.equal(find(wrapper, 'button', 'Consultar / actualizar reservas').props.disabled, true)
    pending.resolve(Response.json({ items: [], total: 0 })); await reading; await flush()
    assert.match(text(wrapper), /No hay reservas/); assert.equal(reads, 1)
    await event(find(mounted.root, 'button', 'Activos'), 'click')
    assert.equal(wrapper.style.display, 'none')
  } finally { mounted.unmount(); await flush() }
})

for (const available of [1, 0]) test(`R3: detalle con ${available} disponible y reservado presenta total completo y reserva segura`, async () => {
  const component = await loadComponent('modules/inventory/pages/ResourceDetailPage')
  const copies = [{ id: 'reserved', recursoId: 'r-final', codigoInventario: 'RES', estado: 'RESERVADO' }, ...(available ? [{ id: 'free', recursoId: 'r-final', codigoInventario: 'FREE', estado: 'DISPONIBLE' }] : [])]
  globalThis.fetch = async url => Response.json(url.endsWith('/copies') ? copies : { ...a, id: 'r-final', availableCopies: available, totalCopies: available })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/app/catalog/:resourceId', component: { template: '<div />' } }] })
  await router.push('/app/catalog/r-final'); await router.isReady()
  const mounted = mount(component, {}, [router])
  try {
    await flush(); await flush()
    assert.match(text(mounted.root).replace(/\s+/g, ' '), new RegExp(`${available} disponible${available === 1 ? '' : 's'} de ${copies.length} ejemplares totales`))
    const reserve = find(mounted.root, 'button', available ? 'Reservar equipo para mí' : 'Sin disponibilidad por el momento')
    assert.equal(reserve.props.disabled, !available)
    if (available) {
      await event(reserve, 'click')
      assert.equal(findAll(mounted.root, n => n.tag === 'option' && n.props.value === 'reserved').length, 0)
      assert.ok(findAll(mounted.root, n => n.tag === 'option' && n.props.value === 'free').length)
    }
  } finally { mounted.unmount(); await flush() }
})

test('R3: inventario agregado incompleto no anuncia total exacto ni consulta copias por fila', async () => {
  const component = await loadComponent('modules/inventory/pages/CatalogPage'), router = await routerAt('/app/admin/catalog')
  const calls = []
  globalThis.fetch = async url => { calls.push(url); return Response.json(url.includes('/categories') ? [category] : { data: [{ ...a, id: 'r-final', availableCopies: 0, totalCopies: 0 }], total: 1 }) }
  const mounted = mount(component, { management: true }, [router])
  try {
    await flush(); await flush()
    assert.match(text(find(mounted.root, 'table')), /Total de ejemplares desconocido/)
    assert.doesNotMatch(text(find(mounted.root, 'table')), /disponibles de 0/)
    assert.equal(calls.some(url => url.endsWith('/copies')), false)
  } finally { mounted.unmount(); await flush() }
})

test('I7: inicio conserva estados independientes, sanción activa antes de categorías y una sola búsqueda en cabecera', async () => {
  const component = await loadComponent('modules/users/pages/StudentAppPage')
  let profileCalls = 0
  globalThis.fetch = async url => {
    if (url.endsWith('/trust')) return Response.json({ percentage: 90, level: 'CONFIABLE' })
    if (url.endsWith('/loan-eligibility')) return Response.json({ enabled: false, reasons: ['SANCION_ACTIVA'] })
    if (url.endsWith('/sanctions')) return Response.json([{ id: 's-final', status: 'ACTIVA', startsAt: new Date().toISOString(), endsAt: null }])
    if (url.endsWith('/history') || url.endsWith('/availability')) return Response.json([])
    if (url.endsWith('/categories')) return Response.json([category])
    profileCalls++; return profileCalls === 1 ? Response.json(null, { status: 503 }) : Response.json({ name: 'Persona recuperada', userType: 'ESTUDIANTE' })
  }
  const mounted = mount(component)
  try {
    await flush(); await flush()
    assert.match(text(mounted.root), /Préstamos no habilitados/)
    assert.match(text(mounted.root), /Confianza: 90/)
    assert.ok(text(mounted.root).indexOf('Sanción activa') < text(mounted.root).indexOf('Explorar catálogo'))
    assert.equal(findAll(mounted.root, n => n.tag === 'input' && n.props.type === 'search').length, 0)
    await event(find(mounted.root, 'button', 'Volver a intentar'), 'click'); await flush()
    assert.equal(text(find(mounted.root, 'h1')), 'Persona recuperada')
    assert.equal(profileCalls, 2)
    assert.ok(find(mounted.root, 'details', 'no indica el estado de la cuenta'))
  } finally { mounted.unmount(); await flush() }
})

test('REFLOW: layout añade estado contextual y lo limpia al desmontar; Más conserva todos los destinos ADMIN', async () => {
  const component = await loadComponent('shared/layouts/AppLayout'), router = await routerAt()
  const mounted = mount(component, {}, [router])
  try {
    assert.equal(document.body.classList.contains('real-app-active'), true)
    const nav = findAll(mounted.root, n => n.props.id === 'app-navigation')[0]
    assert.equal(findAll(nav, n => n.tag === 'a').length, 7)
    const more = find(mounted.root, 'button', 'Más')
    assert.equal(more.props['aria-expanded'], false)
    await event(more, 'click')
    assert.equal(more.props['aria-expanded'], true)
    await router.push('/app/admin/users'); await flush()
    assert.equal(more.props['aria-expanded'], false)
  } finally { mounted.unmount(); await flush() }
  assert.equal(document.body.classList.contains('real-app-active'), false)
})
