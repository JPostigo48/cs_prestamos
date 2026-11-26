import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model, text } from './helpers/renderer.mjs'
import { returnPolicy, closedLoan } from './helpers/loan-closure-fixtures.mjs'
import { compatibility } from './helpers/inventory-compatibility-fixtures.mjs'

const auth = await load('modules/auth/api/auth-api')
const Operations = await loadComponent('modules/loans/pages/LoanOperationsPage')
const Requests = await loadComponent('modules/users/pages/RegistrationRequestsPage')
const Reservations = await loadComponent('modules/loans/components/ReservationsPanel')
const { useUserDetails } = await load('modules/users/useUserDetails')
beforeEach(() => { testEnvironment(); auth.saveSession(session('OPERADOR')) })
const loan = { id: 'loan-visual', copyId: 'copy-visual', userId: 'user-visual', status: 'ACTIVO', startsAt: '2026-01-01T10:00:00Z', endsAt: '2026-01-02T10:00:00Z' }
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII='
const request = { id: 'request-visual', name: 'Solicitante de prueba', userType: 'ESTUDIANTE', institutionalId: 'TEST-01', status: 'PENDIENTE', evidence: [{ information: png }], approvalBlockers: [], rejectionReason: null, approvedUserId: null }

test('panel: tarjetas reales, mora, detalles y resolución de ejemplar única entre listas', async () => {
  const calls = []
  globalThis.fetch = async url => {
    calls.push(String(url))
    if (url.includes('/loans/')) return Response.json([loan])
    if (url.includes('/copies/')) return Response.json({ id: loan.copyId, recursoId: 'r', estado: 'PRESTADO', condicionFisica: 'APTO', habilitado: true, codigoInventario: 'TEST-01', recurso: { id: 'r', nombre: 'Equipo confirmado' } })
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

test('cierre integral refresca activos/vencidos y reservas abiertas una sola vez; conserva resultado visible y foco', async () => {
  let activeReads = 0, overdueReads = 0, reservationReads = 0, writes = 0, closed = false
  globalThis.fetch = async (url, options) => {
    if (url.includes('/reservations?')) { reservationReads++; return Response.json({ items: [], total: 0, page: 1, limit: 20 }) }
    if (url.endsWith('/active')) { activeReads++; return Response.json(closed ? [] : [loan]) }
    if (url.endsWith('/overdue')) { overdueReads++; return Response.json(closed ? [] : [loan]) }
    if (url.endsWith('/return-policy')) return Response.json(returnPolicy(loan.id, []))
    if (url.endsWith('/evidence')) return Response.json([])
    if (url.endsWith('/return')) { writes++; closed = true; return Response.json(closedLoan(loan, JSON.parse(options.body))) }
    if (url.includes('/copies/')) return Response.json({ id: loan.copyId, recursoId: 'r', codigoInventario: 'TEST-01', condicionFisica: 'APTO', habilitado: true, estado: 'PRESTADO', compatibility: compatibility(), recurso: { id: 'r', nombre: 'Equipo' } })
    return Response.json({ id: loan.userId, name: 'Titular' })
  }
  const app = mount(Operations)
  try {
    await flush(); await event(find(app.root, 'button', 'Entregas de reservas'), 'click')
    await event(find(app.root, 'button', 'Consultar / actualizar reservas'), 'click')
    assert.equal(reservationReads, 1)
    await event(find(app.root, 'button', 'Activos'), 'click')
    await event(find(app.root, 'button', 'Registrar devolución'), 'click')
    await flush(); await model(find(find(app.root, 'dialog'), 'input'), 'SANO')
    await event(find(find(app.root, 'dialog'), 'form'), 'submit'); await flush()
    assert.equal(writes, 1); assert.equal(activeReads, 2); assert.equal(overdueReads, 2); assert.equal(reservationReads, 2)
    assert.match(text(find(app.root, 'dialog')), /Devolución real confirmada/)
    assert.equal(document.activeElement.tag, 'h3')
    assert.match(text(app.root), /Activos · 0/)
  } finally { app.unmount() }
})

test('solicitudes: evidencia imagen, filtros HTTP; aprobación crea cuenta original sin alta manual', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    return Response.json(options.method === 'POST' ? { request: { ...request, status: 'APROBADA' }, user: { id: 'new-user' } } : { items: [request], total: 1, page: 1, limit: 20 })
  }
  const app = mount(Requests)
  try {
    await flush()
    assert.equal(find(app.root, 'img').props.src, png)
    assert.doesNotMatch(text(app.root), /base64/)
    await model(find(app.root, 'input'), ' TEST-01 ')
    await event(find(app.root, 'form'), 'submit')
    assert.ok(calls.some(call => call.url.includes('institutionalId=TEST-01')))
    await event(find(app.root, 'button', 'Aprobar vinculación'), 'click')
    assert.match(text(find(app.root, 'dialog')), /crea el usuario y su cuenta/)
    assert.match(text(find(app.root, 'dialog')), /solicitud original/)
    await event(find(find(app.root, 'dialog'), 'form'), 'submit')
    assert.match(text(app.root), /Solicitud aprobada/)
    assert.match(text(app.root), /Ya puede iniciar sesión/)
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 1)
    assert.ok(calls.some(call => call.url.endsWith('/approve')))
    assert.equal(find(app.root, 'button', 'Crear cuenta de acceso'), undefined)
  } finally { app.unmount() }
})

test('solicitudes incompletas: bloquear aprobación y mostrar motivos seguros, nunca base64 crudo; rechazo sigue disponible', async () => {
  const incomplete = [
    { ...request, id: 'missing-credentials', approvalBlockers: ['MISSING_CREDENTIALS'] },
    { ...request, id: 'missing-contract', approvalBlockers: undefined },
    { ...request, id: 'unsafe-reason', approvalBlockers: ['passwordHash=NO-DIVULGAR'] },
    { ...request, id: 'unsafe-evidence', evidence: [{ information: 'data:image/png;base64,NO-DIVULGAR' }] },
    { ...request, id: 'legacy', evidence: [{ information: 'EVIDENCIA-TEXTO-ANTIGUA' }] },
  ]
  let posts = 0
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'POST') { posts++; return Response.json({ ...incomplete[0], status: 'RECHAZADA' }) }
    return Response.json({ items: incomplete, total: incomplete.length, page: 1, limit: 20 })
  }
  const app = mount(Requests)
  try {
    await flush()
    assert.doesNotMatch(text(app.root), /NO-DIVULGAR|EVIDENCIA-TEXTO-ANTIGUA|base64/)
    assert.match(text(app.root), /Faltan los datos originales de acceso/)
    const approvals = findAll(app.root, node => node.tag === 'button' && text(node).includes('Aprobar vinculación'))
    assert.equal(approvals.length, incomplete.length)
    assert.ok(approvals.every(node => node.props.disabled))
    for (const button of approvals) await event(button, 'click')
    assert.equal(find(app.root, 'dialog'), undefined)
    assert.equal(posts, 0)
    await event(find(app.root, 'button', 'Rechazar'), 'click')
    await event(find(find(app.root, 'dialog'), 'form'), 'submit')
    assert.equal(posts, 1)
    assert.match(text(app.root), /Rechazo confirmado/)
  } finally { app.unmount() }
})

test('imagen no decodificable bloquea aprobación; cuenta aprobada nunca ofrece alta manual incluso al administrador', async () => {
  auth.saveSession(session('ADMINISTRADOR'))
  globalThis.fetch = async () => Response.json({ items: [request, { ...request, id: 'approved', status: 'APROBADA', approvedUserId: 'user-created' }], total: 2, page: 1, limit: 20 })
  const app = mount(Requests)
  try {
    await flush()
    assert.equal(find(app.root, 'button', 'Crear cuenta de acceso'), undefined)
    await event(find(app.root, 'img'), 'error')
    assert.equal(find(app.root, 'button', 'Aprobar vinculación').props.disabled, true)
    assert.match(text(app.root), /no pudo visualizarse/)
  } finally { app.unmount() }
})

test('aprobación incierta: cerrar y reabrir no permite duplicar la decisión', async () => {
  let posts = 0
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'POST') { posts++; return Response.json({}, { status: 500 }) }
    return Response.json({ items: [request], total: 1, page: 1, limit: 20 })
  }
  const app = mount(Requests)
  try {
    await flush()
    await event(find(app.root, 'button', 'Aprobar vinculación'), 'click')
    await event(find(find(app.root, 'dialog'), 'form'), 'submit')
    assert.match(text(app.root), /Resultado incierto/)
    await event(find(find(app.root, 'dialog'), 'button', 'Cerrar'), 'click')
    assert.equal(find(app.root, 'button', 'Aprobar vinculación').props.disabled, true)
    await event(find(app.root, 'button', 'Aprobar vinculación'), 'click')
    await event(find(find(app.root, 'dialog'), 'form'), 'submit')
    assert.equal(posts, 1)
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
