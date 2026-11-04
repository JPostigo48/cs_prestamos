import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryHistory, createRouter } from 'vue-router'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model, text } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const api = await load('modules/inventory/api/categories-api')
const inventory = await load('modules/inventory/api/inventory-api')
const guards = await load('shared/api/mutation-guard')
const Editor = await loadComponent('modules/inventory/components/CategoryEditorDialog')
const Delete = await loadComponent('modules/inventory/components/CategoryDeleteDialog')
const Page = await loadComponent('modules/inventory/pages/CategoriesPage')
const Catalog = await loadComponent('modules/inventory/pages/CatalogPage')
const category = { id: 'category', nombre: 'Laboratorio', descripcion: 'Equipos compartidos', activo: true, tiempoMaximoPrestamoDias: 2, tiempoMaximoPrestamoHoras: 48, resourceCount: 2, copyCount: 3 }
const input = { nombre: category.nombre, descripcion: category.descripcion, activo: true, tiempoMaximoPrestamoDias: 2, tiempoMaximoPrestamoHoras: 48 }
const policies = { status: 'INCOMPLETE', eligibleForNewOperations: false, termsVersionId: 'terms-version', rulesEditable: false, message: 'Publicación incompleta', policies: [] }
const preview = { categoryId: category.id, nombre: category.nombre, resourceIds: ['r1', 'r2'], copyIds: ['e1', 'e2', 'e3'], accessoryIds: ['a1'], resourceCount: 2, copyCount: 3, blockers: [], canDelete: true, wouldDelete: { categories: 1, resources: 2, copies: 3, accessories: 1 }, alternative: 'DEACTIVATE' }
beforeEach(() => {
  testEnvironment(); auth.saveSession(session('ADMINISTRADOR'))
  for (const key of [api.categorySaveKey(null, input), api.categorySaveKey(category.id, input), api.categoryDeleteKey(category.id), 'category-active:' + category.id]) guards.confirmMutation(key)
})
const numberInput = root => findAll(root, n => n.tag === 'input' && n.props.type === 'number')[0]

test('API: listado completo o activo explícito, CRUD y activación usan contrato y autenticación', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push([url, options])
    if (options.method === 'DELETE') return Response.json({ deleted: true, categoryId: category.id })
    if (options.method === 'POST' || options.method === 'PATCH') return Response.json({ ...category, ...JSON.parse(options.body) })
    return Response.json([category, { ...category, id: 'inactive', activo: false }])
  }
  assert.equal((await inventory.getCategories()).length, 2)
  await inventory.getCategories(undefined, true)
  await api.saveCategory(null, input)
  await api.saveCategory(category.id, { ...input, tiempoMaximoPrestamoHoras: 7, tiempoMaximoPrestamoDias: 1 })
  await api.setCategoryActive(category.id, false)
  await api.setCategoryActive(category.id, true)
  await api.deleteCategory(category.id)
  assert.deepEqual(calls.map(([url, options]) => [url, options.method]), [
    ['/api/inventory/categories', 'GET'], ['/api/inventory/categories?active=true', 'GET'],
    ['/api/inventory/categories', 'POST'], ['/api/inventory/categories/category', 'PATCH'],
    ['/api/inventory/categories/category', 'PATCH'], ['/api/inventory/categories/category', 'PATCH'], ['/api/inventory/categories/category', 'DELETE'],
  ])
  assert.deepEqual(JSON.parse(calls[3][1].body), { ...input, tiempoMaximoPrestamoHoras: 7, tiempoMaximoPrestamoDias: 1 })
  assert.deepEqual(JSON.parse(calls[4][1].body), { activo: false })
  assert.deepEqual(JSON.parse(calls[5][1].body), { activo: true })
  assert.equal(calls[6][1].body, undefined)
  assert.equal(calls[2][1].headers.Authorization, 'Bearer offline-test-token')
})

for (const role of ['USUARIO', 'OPERADOR']) test(`${role}: no mutaciones ni configuración administrativa`, async () => {
  auth.saveSession(session(role)); let calls = 0
  globalThis.fetch = async () => { calls++; throw Error('No debe llamar') }
  for (const action of [() => api.saveCategory(null, input), () => api.setCategoryActive('x', false), () => api.deleteCategory('x'), () => api.readCategoryPolicies('x'), () => api.readDeletionPreview('x')])
    await assert.rejects(action, error => error.status === 403)
  assert.equal(calls, 0)
})

test('formulario crea con horas enteras y cuatro secciones; ninguna política se copia', async () => {
  const writes = []
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') { writes.push(JSON.parse(options.body)); return Response.json({ ...category, ...writes.at(-1) }) }
    return Response.json(policies)
  }
  const app = mount(Editor, { category: null })
  try {
    assert.match(text(app.root), /no apta para nuevos préstamos/)
    assert.deepEqual(findAll(app.root, n => n.tag === 'nav')[0].children.filter(n => n.tag === 'button').map(text), ['General', 'Préstamos', 'Confianza', 'Sanciones'])
    await model(findAll(app.root, n => n.tag === 'input' && !n.props.type)[0], 'Nueva categoría')
    await event(find(app.root, 'button', 'Préstamos'), 'click')
    await model(numberInput(app.root), 7)
    await event(find(app.root, 'form'), 'submit'); await flush()
    assert.deepEqual(writes, [{ nombre: 'Nueva categoría', descripcion: null, activo: true, tiempoMaximoPrestamoHoras: 7, tiempoMaximoPrestamoDias: 1 }])
    assert.match(text(app.root), /Categoría confirmada/)
    assert.match(text(app.root), /No apta para nuevas operaciones/)
  } finally { app.unmount() }
})

test('edición muestra umbrales, niveles, versiones y consecuencias SOLO lectura del backend', async () => {
  const rules = [
    { id: 'rule-access', ruleId: 'access', number: 4, title: 'Acceso oficial', kind: 'ACCESS', categoryId: category.id, severity: null, trustEffect: 'NONE', penaltyPoints: null, suspensionType: 'NINGUNA', suspensionDays: null, consequence: 'Solo campus', criteria: { condition: 'Uso publicado', access: { allowedLevels: ['ALTO'], durationHours: 48, campusOnly: true } } },
    ...['LEVE', 'MODERADA', 'GRAVE'].map((severity, i) => ({ id: 'rule-' + severity, ruleId: severity, number: 5, title: 'Retraso oficial', kind: 'LATENESS', categoryId: category.id, severity, trustEffect: 'DISCOUNT', penaltyPoints: 11 + i, suspensionType: 'TEMPORAL', suspensionDays: 6 + i, consequence: 'Consecuencia publicada ' + severity, criteria: { condition: 'Incumplimiento publicado', delayHours: { exclusiveMin: i, inclusiveMax: i + 1 } } })),
  ]
  const calls = []
  globalThis.fetch = async (url, options) => { calls.push([url, options.method]); return Response.json({ ...policies, policies: rules }) }
  const app = mount(Editor, { category })
  try {
    await flush(); await event(find(app.root, 'button', 'Confianza'), 'click')
    assert.match(text(app.root), /Niveles admitidos alto/)
    assert.equal(find(app.root, 'button', 'Guardar'), undefined)
    await event(find(app.root, 'button', 'Sanciones'), 'click')
    for (const rule of rules.slice(1)) {
      assert.ok(text(app.root).includes(rule.severity)); assert.ok(text(app.root).includes(`−${rule.penaltyPoints} puntos porcentuales`), text(app.root))
      assert.ok(text(app.root).includes(`${rule.suspensionDays} días`)); assert.ok(text(app.root).includes(rule.consequence))
    }
    assert.match(text(app.root), /Más de 0 horas y hasta 1 horas/)
    assert.equal(findAll(app.root, n => n.tag === 'input' && n.style.display !== 'none').length, 2) // solo nombre y duración, no campos de reglas
    assert.deepEqual(calls, [['/api/inventory/categories/category/policies', 'GET']])
  } finally { app.unmount() }
})

for (const value of [0, 1.5, -2, 2147483648]) test(`duración inválida ${value}: no escribe`, async () => {
  let writes = 0
  globalThis.fetch = async () => { writes++; throw Error('No debe llamar') }
  await assert.rejects(() => api.saveCategory(category.id, { ...input, tiempoMaximoPrestamoHoras: value }), error => error.status === 400)
  assert.equal(writes, 0)
})

test('mutación incierta conserva formulario, bloquea reenvío y permite reconciliar por consulta', async () => {
  let writes = 0
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'PATCH') { writes++; throw Error('Conexión interrumpida') }
    return Response.json(_url.endsWith('/policies') ? policies : category)
  }
  const app = mount(Editor, { category })
  try {
    await flush(); await event(find(app.root, 'form'), 'submit')
    assert.match(text(app.root), /Resultado incierto/)
    assert.equal(find(app.root, 'button', 'Guardar categoría').props.disabled, true)
    await event(find(app.root, 'form'), 'submit'); assert.equal(writes, 1)
    await event(find(app.root, 'button', 'Consultar estado guardado'), 'click')
    assert.match(text(app.root), /los datos coinciden/)
    assert.equal(find(app.root, 'button', 'Guardar categoría').props.disabled, false)
  } finally { app.unmount() }
})

for (const empty of [true, false]) test(`borrado ${empty ? 'vacío' : 'con conjunto sin historia'} muestra preview antes de DELETE`, async () => {
  const calls = [], result = empty ? { ...preview, resourceIds: [], copyIds: [], accessoryIds: [], resourceCount: 0, copyCount: 0, wouldDelete: { categories: 1, resources: 0, copies: 0, accessories: 0 } } : preview
  globalThis.fetch = async (url, options) => { calls.push([url, options.method]); return Response.json(options.method === 'DELETE' ? { deleted: true, categoryId: category.id } : result) }
  const app = mount(Delete, { category })
  try {
    await flush()
    assert.equal(find(app.root, 'dialog').open, true)
    assert.match(text(app.root), /irreversible/)
    assert.ok(text(app.root).includes(`Recursos: ${result.resourceCount} · Ejemplares: ${result.copyCount}`))
    assert.ok(text(app.root).includes(`${result.wouldDelete.resources} recursos, ${result.wouldDelete.copies} ejemplares`))
    if (!empty) assert.match(text(app.root), /r1, r2/)
    assert.deepEqual(calls, [['/api/inventory/categories/category/deletion-preview', 'GET']])
    await event(find(app.root, 'button', 'Eliminar definitivamente'), 'click')
    assert.deepEqual(calls.at(-1), ['/api/inventory/categories/category', 'DELETE'])
  } finally { app.unmount() }
})

test('historial bloquea eliminación, explica dependencia y ofrece desactivar sin borrar', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push([url, options.method, options.body])
    return Response.json(options.method === 'PATCH' ? { ...category, activo: false } : { ...preview, canDelete: false, blockers: [{ dependency: 'prestamos', count: 1, reason: 'Historia protegida' }], wouldDelete: { categories: 0, resources: 0, copies: 0, accessories: 0 } })
  }
  const app = mount(Delete, { category })
  try {
    await flush(); assert.match(text(app.root), /prestamos \(1\): Historia protegida/)
    assert.equal(find(app.root, 'button', 'Eliminar definitivamente').props.disabled, true)
    await event(find(app.root, 'button', 'Eliminar definitivamente'), 'click')
    assert.equal(calls.length, 1)
    await event(find(app.root, 'button', 'Desactivar y conservar'), 'click')
    assert.deepEqual(calls.at(-1), ['/api/inventory/categories/category', 'PATCH', JSON.stringify({ activo: false })])
  } finally { app.unmount() }
})

for (const status of [404, 409, 500, 0]) test(`DELETE ${status}: conserva contexto, exige nueva consulta y nunca falso éxito`, async () => {
  let deletes = 0, reads = 0
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'DELETE') { deletes++; if (!status) throw Error('Red caída'); return Response.json({ message: 'Revalidación fallida' }, { status }) }
    reads++; return Response.json(preview)
  }
  const app = mount(Delete, { category })
  try {
    await flush(); await event(find(app.root, 'button', 'Eliminar definitivamente'), 'click')
    assert.match(text(app.root), /Se conserva el contexto/)
    assert.match(text(app.root), /Laboratorio/)
    assert.equal(find(app.root, 'button', 'Eliminar definitivamente').props.disabled, true)
    await event(find(app.root, 'button', 'Eliminar definitivamente'), 'click'); assert.equal(deletes, 1)
    await event(find(app.root, 'button', 'Consultar previsualización'), 'click'); assert.equal(reads, 2)
    assert.equal(find(app.root, 'button', 'Eliminar definitivamente').props.disabled, false)
  } finally { app.unmount() }
})

test('preview fallida bloquea DELETE; 404 posterior no se interpreta como borrado confirmado', async () => {
  let fail = false, deletes = 0
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'DELETE') { deletes++; fail = true; throw Error('Resultado desconocido') }
    return fail ? Response.json({ message: 'No encontrada' }, { status: 404 }) : Response.json(preview)
  }
  const app = mount(Delete, { category })
  try {
    await flush(); await event(find(app.root, 'button', 'Eliminar definitivamente'), 'click')
    await event(find(app.root, 'button', 'Consultar previsualización'), 'click')
    assert.match(text(app.root), /No se confirma ningún borrado/)
    assert.match(text(app.root), /Laboratorio/)
    assert.match(text(app.root), /Recursos: 2 · Ejemplares: 3/)
    assert.equal(find(app.root, 'button', 'Eliminar definitivamente').props.disabled, true)
    assert.equal(deletes, 1)
  } finally { guards.confirmMutation(api.categoryDeleteKey(category.id)); app.unmount() }
})

test('políticas inseguras o fallidas muestran faltante sin controles de guardado de reglas', async () => {
  let failing = true
  globalThis.fetch = async () => failing ? Response.json({ ...policies, rulesEditable: true }) : Response.json(policies)
  const app = mount(Editor, { category })
  try {
    await flush(); await event(find(app.root, 'button', 'Confianza'), 'click')
    assert.ok(findAll(app.root, n => n.props.role === 'alert').length)
    assert.equal(find(app.root, 'button', 'Guardar'), undefined)
    failing = false; await event(find(app.root, 'button', 'Volver a intentar'), 'click')
    assert.match(text(app.root), /Falta configuración publicada/)
    assert.equal(find(app.root, 'button', 'Guardar'), undefined)
  } finally { app.unmount() }
})

test('dialog: Escape no cierra durante consulta; restaura scroll y foco al desmontarse', async () => {
  let resolvePreview, closes = 0
  globalThis.fetch = () => new Promise(resolve => { resolvePreview = resolve })
  const app = mount(Delete, { category, onClose: () => { closes++ } })
  try {
    const dialog = find(app.root, 'dialog')
    assert.equal(dialog.open, true)
    assert.equal(dialog.props['aria-labelledby'], 'modal-title')
    assert.equal(document.body.style.overflow, 'hidden')
    await event(dialog, 'cancel'); assert.equal(closes, 0)
    resolvePreview(Response.json(preview)); await flush()
    await event(dialog, 'cancel'); assert.equal(closes, 1)
    assert.equal(find(app.root, 'button', 'Eliminar definitivamente').props.disabled, false)
  } finally { app.unmount() }
  assert.equal(document.body.style.overflow, undefined)
})

test('lista incluye inactivas, conteos exactos y activar/desactivar refresca sin DELETE', async () => {
  let active = false
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push([url, options.method])
    if (options.method === 'PATCH') active = JSON.parse(options.body).activo
    return Response.json(options.method === 'PATCH' ? { ...category, activo: active } : [{ ...category, activo: active }])
  }
  const app = mount(Page)
  try {
    await flush(); assert.match(text(app.root), /Inactiva/); assert.match(text(app.root), /Cantidad de recursos 2/)
    await event(find(app.root, 'button', 'Activar'), 'click'); assert.match(text(app.root), /Activa/)
    await event(find(app.root, 'button', 'Desactivar'), 'click'); assert.match(text(app.root), /Inactiva/)
    assert.deepEqual(calls.map(call => call[1]), ['GET', 'PATCH', 'GET', 'PATCH', 'GET'])
    assert.ok(calls.every(([url]) => url === '/api/inventory/categories' || url === '/api/inventory/categories/category'))
  } finally { app.unmount() }
})

for (const management of [false, true]) test(`filtros ${management ? 'inventario' : 'catálogo'} solo filtran y gestión es enlace independiente`, async () => {
  const calls = []
  globalThis.fetch = async url => { calls.push(url); return Response.json(url.includes('/categories') ? [category] : { data: [], total: 0, page: 1, limit: 20 }) }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  const path = management ? '/app/admin/inventory' : '/app/catalog'
  await router.push(path)
  const app = mount(Catalog, { management }, [router])
  try {
    await flush()
    const nav = findAll(app.root, n => n.props['aria-label'] === 'Categorías del catálogo')[0]
    assert.equal(findAll(nav, n => n.tag === 'a').length, 0)
    await event(find(nav, 'button', 'Laboratorio'), 'click'); await flush()
    assert.equal(router.currentRoute.value.path, path)
    assert.equal(router.currentRoute.value.query.categoryId, category.id)
    assert.equal(findAll(app.root, n => n.tag === 'a' && text(n) === 'Gestionar categorías').length, management ? 1 : 0)
    assert.equal(calls[0], '/api/inventory/categories' + (management ? '' : '?active=true'))
  } finally { app.unmount() }
})
