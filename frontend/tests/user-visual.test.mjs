import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ref } from 'vue'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const { errorMessage } = await load('shared/composables/useRemote')
const { ApiError } = await load('shared/api/client')
const Catalog = await loadComponent('modules/inventory/pages/CatalogPage')
const Layout = await loadComponent('shared/layouts/AppLayout')
const { useCopyDetails } = await load('modules/inventory/useCopyDetails')
beforeEach(testEnvironment)

test('errores comprensibles sin contratos ni rutas; conserva validación de negocio y permisos', () => {
  for (const message of ['F14 · Contrato provisional pendiente · HTTP 404', 'Cannot GET /loans/reservations', '/api/users/test']) {
    const shown = errorMessage(new ApiError(message, 404))
    assert.doesNotMatch(shown, /F14|contrato|\/api|\/loans/i)
    assert.match(shown, /consultarla/)
  }
  assert.match(errorMessage(new ApiError('fallo técnico', 503)), /verifica su estado/)
  assert.match(errorMessage(new ApiError('detalle', 403)), /Tu sesión sigue abierta/)
  assert.equal(errorMessage(new ApiError('Cupo de reservas agotado.', 409)), 'Cupo de reservas agotado.')
})

test('catálogo: un buscador, categorías únicas, filtro conserva búsqueda y reinicia página; red real interceptada solo en test', async () => {
  auth.saveSession(session())
  const calls = []
  globalThis.fetch = async url => {
    calls.push(String(url))
    const body = String(url).includes('/categories')
      ? [{ id: 'cat', nombre: 'Libros', resourceCount: 0, tiempoMaximoPrestamoDias: 7, tiempoMaximoPrestamoHoras: 168 }]
      : { data: [], total: 0, page: 1, limit: 20 }
    return new Response(JSON.stringify(body), { status: 200 })
  }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push('/app/catalog?search=texto&page=3&available=false')
  const app = mount(Catalog, {}, [router])
  try {
    await flush()
    assert.equal(findAll(app.root, n => n.tag === 'input' && n.props.type === 'search').length, 1)
    assert.equal(findAll(app.root, n => n.tag === 'select').length, 2)
    await event(find(app.root, 'button', 'Libros'), 'click'); await flush()
    assert.equal(router.currentRoute.value.query.search, 'texto')
    assert.equal(router.currentRoute.value.query.available, 'false')
    assert.equal(router.currentRoute.value.query.categoryId, 'cat')
    assert.equal(router.currentRoute.value.query.page, undefined)
    assert.equal(find(app.root, 'button', 'Libros').props['aria-pressed'], true)
    assert.ok(calls.some(url => url.includes('categoryId=cat') && url.includes('available=false')))
    await event(find(app.root, 'button', 'Todas las categorías'), 'click'); await flush()
    assert.equal(router.currentRoute.value.query.categoryId, undefined)
  } finally { app.unmount() }
})

test('cabecera de catálogo no duplica el buscador de la pantalla', async () => {
  auth.saveSession(session())
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push('/app/catalog')
  const app = mount(Layout, {}, [router])
  try { assert.equal(findAll(app.root, n => n.tag === 'input' && n.props.type === 'search').length, 0) }
  finally { app.unmount() }
})

test('ejemplares compartidos: deduplica solicitudes pendientes, conserva fallback y aborta al desmontar', async () => {
  const source = ref([{ copyId: 'copy-a' }, { copyId: 'copy-a' }])
  const requests = []
  globalThis.fetch = (url, options) => new Promise(resolve => requests.push({ url: String(url), options, resolve }))
  let copies
  const app = mount({ setup() { copies = useCopyDetails(source); return () => null } })
  try {
    await flush()
    assert.equal(requests.length, 1)
    source.value = [{ copyId: 'copy-a' }]; await flush()
    assert.equal(requests.length, 1)
    requests[0].resolve(new Response(JSON.stringify({ id: 'copy-a', codigoInventario: 'TEST-A', recurso: { id: 'resource-a', nombre: 'Nombre confirmado' } }), { status: 200 }))
    await flush()
    assert.equal(copies.value['copy-a'].recurso.nombre, 'Nombre confirmado')
    source.value = [{ copyId: 'copy-a' }, { copyId: 'copy-missing' }]; await flush()
    requests[1].resolve(new Response(JSON.stringify({ message: 'No encontrado' }), { status: 404 })); await flush()
    assert.equal(copies.value['copy-missing'], undefined)
    assert.equal(copies.value['copy-a'].codigoInventario, 'TEST-A')
    source.value = [{ copyId: 'copy-pending' }]; await flush()
  } finally { app.unmount() }
  assert.equal(requests[2].options.signal.aborted, true)
})
