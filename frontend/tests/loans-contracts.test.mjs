import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model, text } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const loans = await load('modules/loans/api/loans-api')
const reservations = await load('modules/loans/api/reservations-api')
const contracts = await load('modules/loans/api/loan-contracts')
const Reservations = await loadComponent('modules/loans/components/ReservationsPanel')
const History = await loadComponent('modules/loans/components/ResourceHistory')
const snapshot = {
  schemaVersion: 1, copyId: 'copy', resourceId: 'article',
  policy: { resourceId: 'article', categoryId: 'category', durationHours: null, effectiveDurationHours: 24, source: 'CATEGORY' },
  accessories: [{ id: 'part', nombre: 'Cable histórico' }],
}
const loan = { id: 'loan', userId: 'owner', copyId: 'copy', status: 'ACTIVO', startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-02T00:00:00Z', return: null, configurationSnapshot: snapshot, returnChecklist: null }
const capture = { id: 'capture', loanId: loan.id, actorId: 'operator', checkedAt: '2026-01-02T00:00:00Z', configurationSnapshot: snapshot, parts: [{ accessoryId: 'part', nombre: 'Cable histórico', received: false }] }
const reservation = { id: 'reservation', userId: 'owner', copyId: 'copy', status: 'CONFIRMADA', requestedAt: '2026-01-01T00:00:00Z', pickupDeadline: '2099-01-01T00:00:00Z', configurationSnapshot: snapshot }
const page = (items, total = items.length, number = 1, limit = 20) => ({ items, total, page: number, limit })
beforeEach(() => { testEnvironment(); auth.saveSession(session('OPERADOR')) })

test('F08: ID de artículo, filtros, paginación y acceso exclusivo de personal', async () => {
  let calls = 0
  globalThis.fetch = async url => {
    calls++
    assert.equal(url, '/api/loans/resource/article%2Fid/history?page=2&limit=20&status=ACTIVO')
    return Response.json(page([loan], 21, 2))
  }
  assert.equal((await loans.getResourceHistory('article/id', { page: '2', status: 'ACTIVO' })).items[0].configurationSnapshot.accessories[0].nombre, 'Cable histórico')
  auth.saveSession(session('USUARIO'))
  await assert.rejects(loans.getResourceHistory('article/id'), e => e.status === 403)
  await assert.rejects(loans.saveReturnChecklist('loan', []), e => e.status === 403)
  assert.equal(calls, 1)
})

test('F08: historial montado pagina, filtra desde página 1 y permite reintentar errores', async () => {
  const calls = []
  let fail = true
  globalThis.fetch = async url => {
    calls.push(String(url))
    if (fail) { fail = false; return Response.json({}, { status: 500 }) }
    const query = new URL(url, 'https://test.invalid').searchParams
    const current = Number(query.get('page'))
    return Response.json(page(current === 1 ? [loan] : [], 21, current))
  }
  const app = mount(History, { resourceId: 'article' })
  try {
    assert.equal(calls.length, 0)
    await event(find(app.root, 'form'), 'submit')
    assert.ok(find(app.root, 'button', 'Volver a intentar'))
    await event(find(app.root, 'button', 'Volver a intentar'), 'click')
    await event(find(app.root, 'button', 'Siguiente'), 'click')
    assert.match(calls.at(-1), /page=2/)
    assert.match(text(app.root), /No hay préstamos/)
    await model(find(app.root, 'select'), 'FINALIZADO')
    await event(find(app.root, 'form'), 'submit')
    assert.match(calls.at(-1), /page=1.*status=FINALIZADO/)
  } finally { app.unmount() }
})

test('parsers: snapshot y captura completos; rechaza duplicados, parcial, fecha y configuración incoherentes', async () => {
  assert.equal(contracts.validSnapshot(snapshot), true)
  assert.equal(contracts.validSnapshot(null), true)
  const versioned = { ...snapshot, reservationNoShow: { termsVersionId: 'terms', ruleVersionId: 'leve' } }
  assert.equal(contracts.validSnapshot(versioned), true)
  assert.equal(contracts.validSnapshot({ ...snapshot, reservationNoShow: { termsVersionId: 'terms' } }), false)
  assert.equal(contracts.sameSnapshot(versioned, { ...versioned, reservationNoShow: { termsVersionId: 'terms', ruleVersionId: 'another' } }), false)
  assert.equal(contracts.validSnapshot({ ...snapshot, accessories: [...snapshot.accessories, ...snapshot.accessories] }), false)
  assert.equal(contracts.validChecklist(capture), true)
  for (const invalid of [{ ...capture, parts: [] }, { ...capture, parts: [...capture.parts, ...capture.parts] }, { ...capture, checkedAt: 'invalid' }, { ...capture, actorId: '' }])
    assert.equal(contracts.validChecklist(invalid), false)
  globalThis.fetch = async () => Response.json({ ...loan, returnChecklist: { ...capture, configurationSnapshot: { ...snapshot, policy: { ...snapshot.policy, effectiveDurationHours: 48 } } } })
  await assert.rejects(loans.getLoan('loan'), e => e.status === 0)
})

// Regresiones F09 del cierre integral: loan-closure.test.mjs.

test('F14: usuario solo propio, filtros, paginación y rechazo de respuesta ajena', async () => {
  const ownSession = session('USUARIO')
  ownSession.user.id = 'owner'
  auth.saveSession(ownSession)
  let calls = 0
  globalThis.fetch = async url => {
    calls++
    const params = new URL(url, 'https://test.invalid').searchParams
    assert.equal(params.get('userId'), 'owner')
    assert.equal(params.get('copyId'), 'copy')
    assert.equal(params.get('status'), 'CONFIRMADA')
    return Response.json(page([reservation]))
  }
  assert.equal((await reservations.listReservations({ copyId: 'copy', status: 'CONFIRMADA' })).items[0].configurationSnapshot.schemaVersion, 1)
  await assert.rejects(reservations.listReservations({ userId: 'other' }), e => e.status === 403)
  await assert.rejects(reservations.listReservations({ limit: '101' }), e => e.status === 400)
  assert.equal(calls, 1)
  globalThis.fetch = async () => Response.json(page([{ ...reservation, userId: 'other' }]))
  await assert.rejects(reservations.listReservations({}), e => e.status === 0)
})

test('F14: personal puede filtrar titular y ejemplar, respuesta debe respetar página solicitada', async () => {
  globalThis.fetch = async url => {
    const params = new URL(url, 'https://test.invalid').searchParams
    assert.equal(params.get('userId'), 'other')
    assert.equal(params.get('copyId'), 'copy')
    return Response.json(page([{ ...reservation, userId: 'other' }], 51, 2, 50))
  }
  assert.equal((await reservations.listReservations({ userId: 'other', copyId: 'copy', page: '2', limit: '50' })).page, 2)
  globalThis.fetch = async () => Response.json(page([]))
  await assert.rejects(reservations.listReservations({ page: '2' }), e => e.status === 0)
})

test('F14: panel pagina sin perder filtro operativo y conserva lectura explícita', async () => {
  const calls = []
  globalThis.fetch = async url => {
    calls.push(String(url))
    assert.match(url, /status=CONFIRMADA/)
    const current = Number(new URL(url, 'https://test.invalid').searchParams.get('page'))
    return Response.json(page([], 21, current))
  }
  const app = mount(Reservations, { staff: true })
  try {
    await flush(); assert.equal(calls.length, 0)
    await event(find(app.root, 'button', 'Consultar / actualizar'), 'click')
    await event(find(app.root, 'button', 'Siguiente'), 'click')
    assert.match(calls.at(-1), /page=2/)
    assert.equal(find(app.root, 'button', 'Siguiente').props.disabled, true)
    await event(find(app.root, 'button', 'Anterior'), 'click')
    assert.match(calls.at(-1), /page=1/)
    assert.equal(calls.length, 3)
  } finally { app.unmount() }
})
