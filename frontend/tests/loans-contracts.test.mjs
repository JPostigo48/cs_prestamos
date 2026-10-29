import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model, text } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const loans = await load('modules/loans/api/loans-api')
const reservations = await load('modules/loans/api/reservations-api')
const contracts = await load('modules/loans/api/loan-contracts')
const Checklist = await loadComponent('modules/loans/components/ReturnChecklist')
const ReturnDialog = await loadComponent('modules/loans/components/ReturnLoanDialog')
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
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
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
  assert.equal(contracts.validSnapshot({ ...snapshot, accessories: [...snapshot.accessories, ...snapshot.accessories] }), false)
  assert.equal(contracts.validChecklist(capture), true)
  for (const invalid of [{ ...capture, parts: [] }, { ...capture, parts: [...capture.parts, ...capture.parts] }, { ...capture, checkedAt: 'invalid' }, { ...capture, actorId: '' }])
    assert.equal(contracts.validChecklist(invalid), false)
  globalThis.fetch = async () => Response.json({ ...loan, returnChecklist: { ...capture, configurationSnapshot: { ...snapshot, policy: { ...snapshot.policy, effectiveDurationHours: 48 } } } })
  await assert.rejects(loans.getLoan('loan'), e => e.status === 0)
})

test('F09: no anuncia éxito hasta persistir, captura inmutable y nunca consulta catálogo actual', async () => {
  const pending = deferred(), calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    return options.method === 'GET' ? Response.json(loan) : pending.promise
  }
  const app = mount(Checklist, { loanId: 'loan', copyId: 'copy', disabled: false })
  try {
    await flush()
    assert.match(text(app.root), /Cable histórico/)
    assert.ok(findAll(app.root, n => n.tag === 'input').every(n => !n.checked))
    assert.equal(find(app.root, 'button', 'Guardar solo checklist').props.disabled, true)
    await model(findAll(app.root, n => n.tag === 'input')[1], false)
    const saving = event(find(app.root, 'button', 'Guardar solo checklist'), 'click')
    await flush()
    assert.doesNotMatch(text(app.root), /Checklist confirmado/)
    pending.resolve(Response.json(capture)); await saving
    assert.match(text(app.root), /Checklist confirmado/)
    assert.equal(find(app.root, 'button', 'Guardar solo checklist').props.disabled, true)
    assert.equal(find(app.root, 'fieldset').props.disabled, true)
    assert.deepEqual(calls.map(c => c.url), ['/api/loans/loan', '/api/loans/loan/return-checklist'])
    assert.deepEqual(JSON.parse(calls[1].options.body).parts, [{ accessoryId: 'part', received: false }])
  } finally { app.unmount() }
})

test('F09: legacy null permite guardar explícitamente vacío; no reconstruye catálogo', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return Response.json(options.method === 'GET' ? { ...loan, configurationSnapshot: null } : { ...capture, configurationSnapshot: null, parts: [] })
  }
  const app = mount(Checklist, { loanId: 'loan', copyId: 'copy', disabled: false })
  try {
    await flush()
    assert.match(text(app.root), /sin configuración histórica/)
    assert.equal(calls.length, 1)
    await event(find(app.root, 'button', 'Guardar solo checklist'), 'click')
    assert.deepEqual(JSON.parse(calls[1].options.body).parts, [])
    assert.match(text(app.root), /Checklist confirmado/)
  } finally { app.unmount() }
})

for (const status of ['PLANIFICADO', 'FINALIZADO']) test(`F09: ${status} no es inspeccionable`, async () => {
  globalThis.fetch = async () => Response.json({ ...loan, status })
  const app = mount(Checklist, { loanId: 'loan', copyId: 'copy', disabled: false })
  try {
    await flush()
    assert.match(text(app.root), /Solo los préstamos ACTIVOS/)
    assert.equal(find(app.root, 'button', 'Guardar solo checklist').props.disabled, true)
  } finally { app.unmount() }
})

test('F09: error de lectura reintentable, conflicto no es éxito y relectura concilia captura existente', async () => {
  let reads = 0, posts = 0
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'POST') { posts++; return Response.json({ message: 'Captura distinta' }, { status: 409 }) }
    reads++
    if (reads === 1) return Response.json({}, { status: 500 })
    return Response.json({ ...loan, returnChecklist: reads >= 3 ? capture : null })
  }
  const app = mount(Checklist, { loanId: 'loan', copyId: 'copy', disabled: false })
  try {
    await flush()
    assert.ok(find(app.root, 'p', 'checklist no está confirmado'))
    await event(find(app.root, 'button', 'Consultar accesorios'), 'click')
    await model(findAll(app.root, n => n.tag === 'input')[0], true)
    await event(find(app.root, 'button', 'Guardar solo checklist'), 'click')
    assert.doesNotMatch(text(app.root), /Checklist confirmado/)
    assert.equal(find(app.root, 'button', 'Guardar solo checklist').props.disabled, true)
    await event(find(app.root, 'button', 'Consultar accesorios'), 'click')
    assert.match(text(app.root), /captura es inmutable/)
    assert.equal(posts, 1)
  } finally { app.unmount() }
})

test('F09: faltantes requieren descripción de incidencia; devolución permanece separada', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return Response.json(options.method === 'GET' ? { ...loan, returnChecklist: capture } : { ...loan, status: 'FINALIZADO', return: { returnedAt: new Date().toISOString() } })
  }
  const app = mount(ReturnDialog, { loan, copyLabel: 'Equipo histórico' })
  try {
    await flush(); await flush()
    assert.match(text(app.root), /partes faltantes/)
    assert.equal(find(app.root, 'button', 'Confirmar solo devolución').props.disabled, true)
    await event(find(app.root, 'form'), 'submit')
    assert.equal(calls.filter(c => c.options.method === 'POST').length, 0)
    await model(find(app.root, 'textarea'), 'Falta el cable histórico')
    await event(find(app.root, 'form'), 'submit')
    const post = calls.find(c => c.options.method === 'POST')
    assert.equal(post.url, '/api/loans/loan/return')
    assert.match(JSON.stringify(JSON.parse(post.options.body)), /Falta el cable histórico/)
    assert.ok(calls.every(c => !c.url.endsWith('/return-checklist')))
  } finally { app.unmount() }
})

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
