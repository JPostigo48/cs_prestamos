import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model, text } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const Users = await loadComponent('modules/users/pages/UsersManagementPage')
const Actions = await loadComponent('modules/users/components/UserActionsDialog')
const Appeals = await loadComponent('modules/trust/pages/AppealsPage')
const Editor = await loadComponent('modules/inventory/components/ResourceEditorDialog')
const Copies = await loadComponent('modules/inventory/components/CopyManager')
const user = { id: 'admin-visual-user', name: 'Usuario confirmado', userType: 'ESTUDIANTE', institutionalId: 'TEST-001', hasCurrentAffiliation: true, trustPercentage: 90 }
const resource = { id: 'admin-visual-resource', nombre: 'Recurso confirmado', categoriaId: 'cat', descripcion: 'Descripción real', availableCopies: 1, totalCopies: 2 }
const category = { id: 'cat', nombre: 'Electrónicos', tiempoMaximoPrestamoDias: 1, tiempoMaximoPrestamoHoras: 24 }
beforeEach(() => { testEnvironment(); auth.saveSession(session('ADMINISTRADOR')) })

test('usuarios: conserva filtros exactos, búsqueda local, paginación y no inventa cuentas', async () => {
  const calls = []
  globalThis.fetch = async url => { calls.push(String(url)); return Response.json({ items: [user], total: 41 }) }
  const app = mount(Users)
  try {
    await flush()
    assert.match(text(app.root), /Gestión de Usuarios/)
    assert.doesNotMatch(text(app.root), /F10|contrato provisional/)
    assert.equal(calls.length, 1)
    const inputs = findAll(app.root, n => n.tag === 'input')
    await model(inputs[0], ' TEST-001 ')
    await event(find(app.root, 'form'), 'submit')
    assert.ok(calls.at(-1).includes('institutionalId=TEST-001'))
    await model(inputs[1], 'No coincide')
    assert.match(text(app.root), /No hay usuarios que coincidan/)
    assert.equal(calls.length, 2)
    await event(find(app.root, 'button', 'Siguiente'), 'click')
    assert.ok(calls.at(-1).includes('page=2'))
  } finally { app.unmount() }
})

test('cuenta y rol: consulta a demanda, permiso confirmado y cambio con accountId', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    if (url.includes('/sanctions')) return Response.json([])
    const account = { id: 'admin-visual-account', userId: user.id, email: 'visual@example.invalid', role: options.method === 'PATCH' ? 'OPERADOR' : 'USUARIO', enabled: true }
    return Response.json(options.method === 'PATCH' ? account : { items: [account] })
  }
  const app = mount(Actions, { user })
  try {
    await flush()
    assert.ok(!calls.some(c => c.url.includes('/auth/accounts')))
    assert.doesNotMatch(text(app.root), /F10|F11|F12/)
    await event(find(app.root, 'button', 'Consultar cuenta'), 'click')
    const role = findAll(app.root, n => n.tag === 'select')[0]
    await model(role, 'OPERADOR')
    await event(find(app.root, 'form'), 'submit')
    const write = calls.find(c => c.options.method === 'PATCH')
    assert.ok(write.url.endsWith('/auth/accounts/admin-visual-account'))
    assert.deepEqual(JSON.parse(write.options.body), { role: 'OPERADOR' })
    assert.match(text(app.root), /Rol actualizado/)
  } finally { app.unmount() }
})

test('apelaciones: bandeja explícita, titular real, resolución con fundamento y lectura posterior', async () => {
  const calls = []
  const appeal = { id: 'admin-visual-appeal', violationId: 'violation-real', userId: user.id, sanctionId: null, status: 'PENDIENTE', reason: 'Argumento confirmado', submittedAt: '2026-10-20T10:00:00Z', resolution: null, resolvedAt: null, resolvedByAccountId: null }
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    if (url.includes('/users/')) return Response.json(user)
    if (options.method === 'PATCH') return Response.json({ ...appeal, status: 'ACEPTADA', resolution: 'Fundamento de prueba' })
    return Response.json({ items: [appeal], total: 1, page: 1, limit: 20 })
  }
  const app = mount(Appeals)
  try {
    await flush(); assert.equal(calls.length, 0)
    await event(find(app.root, 'form'), 'submit'); await flush()
    assert.match(text(app.root), /Usuario confirmado/)
    assert.match(text(app.root), /Argumento del apelante/)
    await event(find(app.root, 'button', 'Aprobar apelación'), 'click')
    const dialog = find(app.root, 'dialog')
    assert.equal(find(dialog, 'button', 'Confirmar resolución').props.disabled, true)
    await model(find(dialog, 'textarea'), 'Fundamento de prueba')
    await event(find(dialog, 'form'), 'submit')
    assert.deepEqual(JSON.parse(calls.find(c => c.options.method === 'PATCH').options.body), { status: 'ACEPTADA', resolution: 'Fundamento de prueba' })
    assert.equal(calls.filter(c => c.url.includes('/appeals?')).length, 2)
    assert.match(text(app.root), /Resolución confirmada/)
  } finally { app.unmount() }
})

test('editor: artículo, ejemplares, accesorios y duración conservan guardados separados', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    if (url.includes('/copies')) return Response.json([])
    if (url.endsWith('/accessories')) return Response.json({ items: [] })
    return Response.json({ ...resource, loanPolicy: { resourceId: resource.id, categoryId: 'cat', durationHours: null, effectiveDurationHours: 24, source: 'CATEGORY' } })
  }
  const app = mount(Editor, { resource, categories: [category] })
  try {
    await flush()
    assert.doesNotMatch(text(app.root), /F07|F13|pendiente de backend/)
    assert.match(text(app.root), /Duración de la categoría: 1 días/)
    await event(find(app.root, 'form'), 'submit')
    assert.equal(calls.filter(c => c.options.method === 'PATCH').length, 1)
    assert.deepEqual(JSON.parse(calls.at(-1).options.body), { nombre: resource.nombre, categoriaId: 'cat', descripcion: resource.descripcion })
    assert.ok(!calls.some(c => /accessories|loan-policy/.test(c.url) && c.options.method !== 'GET'))
    await event(find(app.root, 'button', 'Duración'), 'click')
    assert.equal(find(app.root, 'button', 'Duración').props['aria-pressed'], true)
  } finally { app.unmount() }
})

test('ejemplares: no ofrece alterar ocupados y confirma antes de cambiar disponibilidad', async () => {
  const calls = [], copy = { id: 'visual-copy', recursoId: resource.id, codigoInventario: 'TEST-COPY', estado: 'DISPONIBLE' }
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    if (url.endsWith('/state')) return Response.json({ ...copy, estado: 'NO_DISPONIBLE' })
    if (url.includes('/resources/')) return Response.json([copy, { ...copy, id: 'occupied-copy', estado: 'PRESTADO' }])
    return Response.json(copy)
  }
  const app = mount(Copies, { resourceId: resource.id })
  try {
    await flush()
    assert.equal(findAll(app.root, n => n.tag === 'button' && text(n).includes('Inhabilitar')).length, 1)
    await event(find(app.root, 'button', 'Inhabilitar'), 'click')
    assert.equal(calls.length, 1)
    await event(find(app.root, 'button', 'Confirmar cambio'), 'click')
    assert.equal(calls.filter(c => c.options.method === 'PATCH').length, 1)
    assert.match(text(app.root), /Estado confirmado/)
  } finally { app.unmount() }
})
