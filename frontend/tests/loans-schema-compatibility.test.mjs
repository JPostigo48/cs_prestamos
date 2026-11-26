import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, loadComponent, session, testEnvironment } from './helpers/modules.mjs'
import { mount, flush, find, findAll, text, model, event } from './helpers/renderer.mjs'
import { activeLoan, closedLoan, returnBody, returnPolicy } from './helpers/loan-closure-fixtures.mjs'
import { compatibility, inventoryCopy } from './helpers/inventory-compatibility-fixtures.mjs'
import { sanction } from './helpers/trust-fixtures.mjs'

const contracts = await load('modules/loans/api/loan-contracts')
const api = await load('modules/loans/api/loans-api')
const auth = await load('modules/auth/api/auth-api')
const trust = await load('modules/trust/api/trust-contracts')
const Notice = await loadComponent('modules/loans/components/ClosureHistoryNotice')
const Result = await loadComponent('modules/loans/components/ClosureResult')
const Return = await loadComponent('modules/loans/components/ReturnLoanDialog')
const Incident = await loadComponent('modules/loans/components/CloseIncidentDialog')
const Reservation = await loadComponent('modules/loans/components/ReservationDialog')
const Sanction = await loadComponent('modules/trust/components/SanctionDetails')
const Reservations = await loadComponent('modules/loans/components/ReservationsPanel')
beforeEach(() => { testEnvironment(); auth.saveSession(session('OPERADOR')); api.setPendingReturn('loan', false) })
const historyLoan = (state = 'AVAILABLE') => ({ ...activeLoan(), closureHistory: state, closure: null, consequences: [], reward: null, copy: null, cancelledReservationIds: [] })

for (const state of [undefined, 'UNAVAILABLE', 'AVAILABLE']) test(`historial ${state}: conserva devolución antigua y distingue ausencia de capacidad`, () => {
  const loan = state === undefined ? activeLoan() : historyLoan(state)
  loan.status = 'FINALIZADO'; loan.return = { returnedAt: '2026-01-02T00:00:00Z' }
  const parsed = contracts.parseLoan(loan)
  assert.deepEqual(parsed.return, loan.return)
  const app = mount(Notice, { loan: parsed })
  try { assert.match(text(app.root), state === 'AVAILABLE' ? /No se encontró un cierre integral persistido/ : /Historial de cierre no disponible/); assert.doesNotMatch(text(app.root), /Sin consecuencias|Sin recompensa/) }
  finally { app.unmount() }
})
for (const value of [null, undefined, 'UNKNOWN', true, {}, ['AVAILABLE'], ['UNAVAILABLE']]) test(`metadato presente inválido no cae a legacy: ${JSON.stringify(value)}`, () => {
  assert.throws(() => contracts.parseLoan({ ...historyLoan(), closureHistory: value }), e => e.status === 0)
})
for (const key of ['closure', 'consequences', 'reward', 'copy', 'cancelledReservationIds']) test(`nuevo historial exige ${key}`, () => {
  const loan = historyLoan(); delete loan[key]
  assert.throws(() => contracts.parseLoan(loan), e => e.status === 0)
})
test('UNAVAILABLE no admite cierre inventado; AVAILABLE conserva resultado original', () => {
  const closed = { ...closedLoan(activeLoan(), returnBody()), closureHistory: 'AVAILABLE' }
  assert.deepEqual(contracts.parseLoan(closed), closed)
  assert.throws(() => contracts.parseLoan({ ...closed, closureHistory: 'UNAVAILABLE' }))
  assert.throws(() => contracts.parseLoan({ ...historyLoan(), consequences: [{}] }))
})
test('listas activas/vencidas validan filas y propagan 503 sin lista vacía', async () => {
  for (const fn of [api.getActiveLoans, api.getOverdueLoans]) {
    globalThis.fetch = async () => Response.json([historyLoan('UNAVAILABLE')])
    assert.equal((await fn())[0].closureHistory, 'UNAVAILABLE')
    globalThis.fetch = async () => Response.json([{ ...historyLoan(), closureHistory: null }])
    await assert.rejects(fn(), e => e.status === 0)
    globalThis.fetch = async () => Response.json({ message: 'Temporalmente no disponible' }, { status: 503 })
    await assert.rejects(fn(), e => e.status === 503)
  }
})
test('política de devolución incompleta no inventa ausencia de mora', async () => {
  for (const key of ['currentSeverity', 'targetSeverity', 'appliedPenaltyPoints']) {
    const policy = returnPolicy(); delete policy.lateness[key]
    globalThis.fetch = async () => Response.json(policy)
    await assert.rejects(api.getReturnPolicy('loan'), e => e.status === 0)
  }
})
test('resultado sin cierre conocido no anuncia pérdida, cero consecuencias ni cero recompensas', () => {
  const app = mount(Result, { loan: historyLoan('UNAVAILABLE') })
  try { assert.match(text(app.root), /Historial de cierre no disponible/); assert.doesNotMatch(text(app.root), /Cierre por pérdida|Sin consecuencias|Sin recompensa|Reservas canceladas: 0/) }
  finally { app.unmount() }
})
for (const meta of [undefined, null, compatibility(false), compatibility()]) {
  for (const [Component, name] of [[Return, 'devolución'], [Incident, 'incidencia']]) test(`${name}: aviso y bloqueo según capacidades ${meta?.status ?? 'legacy'}`, async () => {
    let writes = 0
    globalThis.fetch = async (url, options) => {
      if (options.method === 'POST') { writes++; throw Error('No se esperaba escritura') }
      return Response.json(url.endsWith('/return-policy') ? returnPolicy('loan', []) : [])
    }
    const app = mount(Component, { loan: activeLoan(), copyLabel: 'Ejemplar', compatibility: meta })
    try {
      await flush()
      if (Component === Return) await model(findAll(app.root, n => n.tag === 'input' && n.props.type === 'radio')[0], 'SANO')
      else { await model(find(app.root, 'select'), 'PERDIDA'); await model(find(app.root, 'textarea'), 'Incidente confirmado'); await model(findAll(app.root, n => n.tag === 'input' && n.props.type === 'checkbox').at(-1), true) }
      assert.equal(find(app.root, 'button', 'Confirmar').props.disabled, meta?.status !== 'READY')
      if (meta?.status !== 'READY') { assert.match(text(app.root), /inventario.*(pendiente|desconocida)/); await event(find(app.root, 'form'), 'submit'); assert.equal(writes, 0) }
    } finally { app.unmount() }
  })
}
test('reserva excluye ocupación libre sin aptitud acreditada y muestra aviso', async () => {
  globalThis.fetch = async () => Response.json({ version: 1, pickupWaitMinutes: 10, weeklySchedule: null, timeZone: 'America/Lima', scheduleStatus: 'UNCONFIGURED', warning: 'Horario sin configurar' })
  const app = mount(Reservation, { copies: [inventoryCopy(false)], resourceName: 'Recurso' })
  try { await flush(); assert.equal(findAll(app.root, n => n.tag === 'option').length, 1); assert.equal(find(app.root, 'button', 'Confirmar reserva').props.disabled, true); assert.match(text(app.root), /Actualización de inventario pendiente/); assert.match(text(app.root), /aptitud y disponibilidad verificadas/) }
  finally { app.unmount() }
})
test('503 conserva intención/UUID; conciliar UNAVAILABLE nunca confirma ausencia ni habilita fallback', async () => {
  const calls = [], body = returnBody()
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return options.method === 'POST' ? Response.json({ message: 'Temporal', code: 'SCHEMA_CAPABILITY_UNAVAILABLE' }, { status: 503 }) : Response.json(historyLoan('UNAVAILABLE')) }
  await assert.rejects(api.returnLoan('loan', body), e => e.status === 503)
  assert.deepEqual(api.getPendingClosure('loan'), body); assert.equal(api.hasPendingReturn('loan'), true)
  assert.equal(await api.reconcileClosure('loan'), null)
  assert.deepEqual(api.getPendingClosure('loan'), body)
  await assert.rejects(api.returnLoan('loan', { ...body, requestId: 'otra-clave' }), e => e.status === 409)
  await assert.rejects(api.returnLoan('loan', body), e => e.status === 503)
  const posts = calls.filter(c => c.options.method === 'POST')
  assert.equal(posts.length, 2); assert.equal(posts[0].options.body, posts[1].options.body); assert.ok(posts.every(c => c.url.endsWith('/return')))
})
test('503 renderizado: aviso temporal, datos bloqueados y reintento exclusivamente con clave original', async () => {
  let writes = 0
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') { writes++; return Response.json({ statusCode: 503, code: 'SCHEMA_CAPABILITY_UNAVAILABLE', operation: 'loans.close', diagnostic: 'SCHEMA_INCOMPLETE', message: 'La operación no está disponible temporalmente. Intente nuevamente más tarde.' }, { status: 503 }) }
    if (url.endsWith('/return-policy')) return Response.json(returnPolicy('loan', []))
    return Response.json(url.endsWith('/evidence') ? [] : historyLoan('UNAVAILABLE'))
  }
  const app = mount(Return, { loan: activeLoan(), copyLabel: 'Ejemplar', compatibility: compatibility() })
  try {
    await flush(); await model(findAll(app.root, n => n.tag === 'input' && n.props.type === 'radio')[0], 'SANO')
    await event(find(app.root, 'form'), 'submit')
    assert.match(text(app.root), /temporalmente no disponible/); assert.match(text(app.root), /no se utilizará una devolución básica alternativa/)
    assert.match(text(app.root), /SCHEMA_CAPABILITY_UNAVAILABLE: loans\.close/)
    assert.equal(find(app.root, 'button', 'Confirmar devolución integral').props.disabled, true)
    const original = api.getPendingClosure('loan')
    await event(find(app.root, 'button', 'Reintentar mismo cuerpo y UUID'), 'click')
    assert.equal(writes, 2); assert.deepEqual(api.getPendingClosure('loan'), original)
  } finally { app.unmount() }
})
for (const staff of [false, true]) test(`reservas ${staff ? 'entrega' : 'cancelación'}: capacidades parciales conservan lectura y bloquean escritura`, async () => {
  const reservation = { id: 'r', copyId: 'c1', userId: session().user.id, requestedAt: '2099-01-01T00:00:00Z', pickupDeadline: '2099-01-01T01:00:00Z', configurationSnapshot: null, status: 'CONFIRMADA' }
  let writes = 0
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST' || options.method === 'DELETE') { writes++; throw Error('No debe escribir') }
    if (url.includes('/reservations?')) return Response.json({ items: [reservation], total: 1, page: 1, limit: 20 })
    if (url.includes('/copies/')) return Response.json({ ...inventoryCopy(false, { estado: 'RESERVADO' }), recurso: { id: 'r1', nombre: 'Recurso' } })
    return Response.json({ id: reservation.userId, name: 'Titular' })
  }
  const app = mount(Reservations, { staff })
  try {
    if (staff) await event(find(app.root, 'button', 'Consultar / actualizar reservas'), 'click')
    await flush(); await flush()
    assert.match(text(app.root), /Actualización de inventario pendiente/)
    assert.equal(find(app.root, 'button', staff ? 'Confirmar entrega' : 'Cancelar mi reserva').props.disabled, true)
    await event(find(app.root, 'button', staff ? 'Confirmar entrega' : 'Cancelar mi reserva'), 'click')
    await event(find(app.root, 'form'), 'submit'); assert.equal(writes, 0)
  } finally { app.unmount() }
})
for (const current of [undefined, null]) test(`sanción ${current}: episodio desconocido no se anuncia ausente`, async () => {
  const detail = sanction(); if (current === null) detail.current = null
  assert.equal(trust.validSanctionDetail(detail), true)
  assert.equal(trust.validSanctionDetail({ ...detail, current: undefined }), false)
  assert.equal(trust.validSanctionDetail({ ...detail, current: {} }), false)
  globalThis.fetch = async () => Response.json(detail)
  const app = mount(Sanction, { sanctionId: detail.id })
  try { await flush(); assert.match(text(app.root), current === null ? /Sin episodio de ajustes asociado/ : /Historial de ajustes desconocido/); assert.doesNotMatch(text(app.root), /Sin historial de ajustes/) }
  finally { app.unmount() }
})
