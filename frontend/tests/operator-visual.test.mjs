import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model, text } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const Operations = await loadComponent('modules/loans/pages/LoanOperationsPage')
const Requests = await loadComponent('modules/users/pages/RegistrationRequestsPage')
const Checklist = await loadComponent('modules/loans/components/ReturnChecklist')
const Reservations = await loadComponent('modules/loans/components/ReservationsPanel')
const { useUserDetails } = await load('modules/users/useUserDetails')
beforeEach(() => { testEnvironment(); auth.saveSession(session('OPERADOR')) })
const loan = { id: 'loan-visual', copyId: 'copy-visual', userId: 'user-visual', status: 'ACTIVO', startsAt: '2026-01-01T10:00:00Z', endsAt: '2026-01-02T10:00:00Z' }
const request = { id: 'request-visual', name: 'Solicitante de prueba', userType: 'ESTUDIANTE', institutionalId: 'TEST-01', status: 'PENDIENTE', evidence: [{ information: 'Vinculación de prueba' }], rejectionReason: null, approvedUserId: null }

test('panel: tarjetas reales, mora, detalles y resolución de ejemplar única entre listas', async () => {
  const calls = []
  globalThis.fetch = async url => {
    calls.push(String(url))
    if (url.includes('/loans/')) return Response.json([loan])
    if (url.includes('/copies/')) return Response.json({ id: loan.copyId, codigoInventario: 'TEST-01', recurso: { id: 'r', nombre: 'Equipo confirmado' } })
    return Response.json({ id: loan.userId, name: 'Titular confirmado' })
  }
  const app = mount(Operations)
  try {
    await flush(); await flush()
    assert.match(text(app.root), /Titular confirmado/)
    assert.match(text(app.root), /Equipo confirmado/)
    assert.match(text(app.root), /En mora/)
    assert.equal(calls.filter(url => url.includes('/copies/')).length, 1)
    assert.ok(find(app.root, 'a', 'Solicitudes'))
    await event(find(app.root, 'button', 'En mora'), 'click')
    assert.equal(find(app.root, 'button', 'En mora').props['aria-pressed'], true)
    assert.ok(find(app.root, 'button', 'Registrar devolución'))
  } finally { app.unmount() }
})

test('checklist: ninguna selección implícita; guarda separado y no registra devolución', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    if (url.includes('/copies/')) return Response.json({ recursoId: 'resource' })
    if (url.includes('/accessories')) return Response.json({ items: [{ id: 'part', nombre: 'Cable de prueba' }] })
    return Response.json({ id: 'inspection', loanId: loan.id, parts: [{ accessoryId: 'part', received: false }], checkedAt: new Date().toISOString() })
  }
  const app = mount(Checklist, { loanId: loan.id, copyId: loan.copyId, disabled: false })
  try {
    await event(find(app.root, 'button', 'Consultar accesorios'), 'click'); await flush()
    assert.equal(find(app.root, 'button', 'Guardar solo checklist').props.disabled, true)
    const radios = findAll(app.root, node => node.tag === 'input' && node.props.type === 'radio')
    assert.ok(radios.every(node => !node.checked))
    await model(radios[1], false)
    await event(find(app.root, 'button', 'Guardar solo checklist'), 'click')
    assert.match(text(app.root), /Checklist confirmado por el servidor/)
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 1)
    assert.ok(calls.at(-1).url.endsWith('/return-checklist'))
    const body = JSON.parse(calls.at(-1).options.body)
    assert.deepEqual(body.parts, [{ accessoryId: 'part', received: false }])
    assert.ok(Number.isFinite(Date.parse(body.checkedAt)))
  } finally { app.unmount() }
})

test('solicitudes: evidencia, filtros HTTP, aprobación confirmada sin crear acceso', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    return Response.json(options.method === 'POST' ? { request: { ...request, status: 'APROBADA' }, user: { id: 'new-user' } } : { items: [request], total: 1, page: 1, limit: 20 })
  }
  const app = mount(Requests)
  try {
    await flush()
    assert.match(text(app.root), /Vinculación de prueba/)
    await model(find(app.root, 'input'), ' TEST-01 ')
    await event(find(app.root, 'form'), 'submit')
    assert.ok(calls.some(call => call.url.includes('institutionalId=TEST-01')))
    await event(find(app.root, 'button', 'Aprobar vinculación'), 'click')
    assert.match(text(find(app.root, 'dialog')), /no una cuenta de acceso/)
    await event(find(find(app.root, 'dialog'), 'form'), 'submit')
    assert.match(text(app.root), /Solicitud aprobada/)
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 1)
    assert.ok(calls.some(call => call.url.endsWith('/approve')))
    assert.equal(find(app.root, 'button', 'Crear cuenta de acceso'), undefined)
  } finally { app.unmount() }
})

test('entregas: consulta explícita y error comprensible, sin éxito ni entrega ficticia', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json({ message: 'Cannot GET /loans/reservations' }, { status: 404 }) }
  const app = mount(Reservations, { staff: true })
  try {
    await flush(); assert.equal(calls, 0)
    await event(find(app.root, 'button', 'Consultar / actualizar'), 'click')
    assert.equal(calls, 1)
    assert.doesNotMatch(text(app.root), /F14|Cannot GET|contrato provisional/)
    assert.equal(find(app.root, 'button', 'Confirmar entrega'), undefined)
    assert.ok(find(app.root, 'button', 'Volver a intentar'))
  } finally { app.unmount() }
})

test('titulares compartidos: consulta solo fuentes recibidas, deduplica, conserva fallback y aborta', async () => {
  const source = ref(null), calls = []
  globalThis.fetch = (url, options) => new Promise(resolve => calls.push({ url: String(url), options, resolve }))
  let users
  const app = mount({ setup() { users = useUserDetails(source); return () => null } })
  try {
    await flush(); assert.equal(calls.length, 0)
    source.value = [{ userId: 'person' }, { userId: 'person' }]; await flush()
    assert.equal(calls.length, 1)
    source.value = [{ userId: 'person' }]; await flush(); assert.equal(calls.length, 1)
    calls[0].resolve(Response.json({ id: 'person', name: 'Nombre confirmado' })); await flush()
    assert.equal(users.value.person.name, 'Nombre confirmado')
    source.value = [{ userId: 'missing' }]; await flush()
    calls[1].resolve(Response.json({}, { status: 404 })); await flush()
    assert.equal(users.value.missing, undefined)
    source.value = [{ userId: 'pending' }]; await flush()
  } finally { app.unmount() }
  assert.equal(calls[2].options.signal.aborted, true)
})
