import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, text, event, model } from './helpers/renderer.mjs'
import { sanction as detailedSanction, rule, ruleId } from './helpers/trust-fixtures.mjs'

const auth = await load('modules/auth/api/auth-api')
const client = await load('shared/api/client')
const guard = await load('shared/api/mutation-guard')
const loans = await load('modules/loans/api/loans-api')
const reservations = await load('modules/loans/api/reservations-api')
const student = await load('modules/users/api/student-api')
const inventory = await load('modules/inventory/api/inventory-api')
const query = await load('modules/inventory/catalog-query')
const policy = await load('modules/loans/return-policy')
const trustContracts = await load('modules/trust/api/trust-contracts')
const trust = await load('modules/trust/api/trust-api')
const { useRemote } = await load('shared/composables/useRemote')
const account = id => ({ ...session(), accessToken: 'offline-' + id, user: { ...session().user, id } })
beforeEach(() => { testEnvironment(); auth.saveSession(account('owner')); client.onUnauthorized(() => auth.clearSession()) })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

test('I1: 401 elimina sesión, pero libera la clave original y permite relogin', async () => {
  globalThis.fetch = async () => Response.json(null, { status: 401 })
  await assert.rejects(guard.guardedMutation('i1-401', () => auth.authenticatedRequest('/offline')), e => e.status === 401)
  assert.equal(auth.getSession(), null)
  auth.saveSession(account('owner'))
  assert.equal(guard.pendingMutation('i1-401'), false)
  assert.equal(await guard.guardedMutation('i1-401', async () => 'confirmado'), 'confirmado')
})
test('I1: cuentas sucesivas, respuestas inversas no limpian bloqueos ajenos', async () => {
  const a = deferred(), b = deferred()
  auth.saveSession(account('i1-A'))
  const first = guard.guardedMutation('same', () => a.promise)
  auth.saveSession(account('i1-B'))
  const second = guard.guardedMutation('same', () => b.promise)
  b.resolve('B'); await second
  assert.equal(guard.pendingMutation('same'), false)
  // Una nueva operación B debe sobrevivir a la respuesta tardía A.
  const c = deferred(), third = guard.guardedMutation('same', () => c.promise)
  a.resolve('A'); await first
  assert.equal(guard.pendingMutation('same'), true)
  c.resolve('B2'); await third
  auth.saveSession(account('i1-A')); assert.equal(guard.pendingMutation('same'), false)
})
test('I1: reconciliación de devolución tardía afecta únicamente al titular capturado', async () => {
  auth.saveSession(account('return-A')); loans.setPendingReturn('same-loan', true)
  const d = deferred(); globalThis.fetch = () => d.promise
  const reading = loans.reconcileReturn('same-loan')
  auth.saveSession(account('return-B')); loans.setPendingReturn('same-loan', true)
  d.resolve(Response.json({ id: 'same-loan', status: 'FINALIZADO', return: { returnedAt: new Date().toISOString() } }))
  assert.equal(await reading, true); assert.equal(loans.hasPendingReturn('same-loan'), true)
  auth.saveSession(account('return-A')); assert.equal(loans.hasPendingReturn('same-loan'), false)
})
test('I1: lectura anterior no limpia una operación posterior de la misma cuenta', async () => {
  await assert.rejects(guard.guardedMutation('i1-generation', async () => { throw new client.ApiError('incierto', 0) }))
  const oldReading = guard.mutationConfirmation()
  guard.confirmMutation('i1-generation')
  const d = deferred(), operation = guard.guardedMutation('i1-generation', () => d.promise)
  assert.equal(oldReading('i1-generation'), false)
  assert.equal(guard.pendingMutation('i1-generation'), true)
  d.resolve('ok'); await operation
})
for (const [name, body] of [['null', null], ['ajena', { id: 'a', userId: 'other', sanctionId: 's', status: 'PENDIENTE' }], ['sanción ajena', { id: 'a', userId: 'owner', sanctionId: 'other', status: 'PENDIENTE' }], ['estado no pendiente', { id: 'a', userId: 'owner', sanctionId: 's', status: 'ACEPTADA' }]]) {
  test('I2: respuesta ' + name + ' no confirma ni permite duplicar', async () => {
    const id = 'i2-' + name; let calls = 0
    globalThis.fetch = async () => { calls++; return Response.json(body, { status: 201 }) }
    await assert.rejects(student.submitAppeal(id, 'Texto conservado'), e => e.status === 0)
    await assert.rejects(student.submitAppeal(id, 'Texto conservado'), e => e.status === 0)
    assert.equal(calls, 1); assert.equal(student.confirmedAppeal(id), undefined)
  })
}
test('I2: confirmación real en memoria impide reapelar incluso tras relogin', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json({ id: 'appeal-real', userId: 'owner', sanctionId: 'i2-confirmed', status: 'PENDIENTE' }) }
  await student.submitAppeal('i2-confirmed', 'Fundamento')
  auth.clearSession(); auth.saveSession(account('owner'))
  assert.equal(student.confirmedAppeal('i2-confirmed').id, 'appeal-real')
  await assert.rejects(student.submitAppeal('i2-confirmed', 'Fundamento'), e => e.status === 409)
  assert.equal(calls, 1)
})
test('I2: incertidumbre de red mantiene bloqueo sin confirmación inventada', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; throw new TypeError('offline') }
  await assert.rejects(student.submitAppeal('i2-network', 'Conservar texto'), e => e.status === 0)
  assert.equal(student.appealBlocked('i2-network'), true)
  assert.equal(student.confirmedAppeal('i2-network'), undefined)
  await assert.rejects(student.submitAppeal('i2-network', 'Conservar texto')); assert.equal(calls, 1)
})
test('I3: alta A incierta no bloquea B; ausencia no libera A y evidencia exacta sí', async () => {
  const a = { nombre: 'I3 A', categoriaId: 'cat', descripcion: 'Original' }, b = { ...a, nombre: 'I3 B' }
  globalThis.fetch = async () => { throw new TypeError('offline') }
  await assert.rejects(inventory.saveResource(null, a))
  globalThis.fetch = async () => Response.json({ ...b, id: 'B-real' })
  assert.equal((await inventory.saveResource(null, b)).id, 'B-real')
  const filters = query.catalogFilters({})
  globalThis.fetch = async () => Response.json({ data: [{ ...a, id: 'other', descripcion: 'Distinta' }], total: 1 })
  await inventory.getResources(filters)
  assert.equal(guard.pendingMutation(inventory.resourceIntent(a)), true)
  globalThis.fetch = async () => Response.json({ data: [{ ...a, id: 'A-real' }], total: 1 })
  await inventory.getResources(filters)
  assert.equal(guard.pendingMutation(inventory.resourceIntent(a)), false)
  globalThis.fetch = async (url, options) => { assert.equal(options.method ?? 'GET', 'GET'); assert.equal(url, '/api/inventory/resources/A-real'); return Response.json({ ...a, id: 'A-real' }) }
  assert.equal((await inventory.saveResource(null, a)).id, 'A-real')
})
test('I3: ejemplares con códigos distintos son independientes y lectura positiva reconcilia', async () => {
  globalThis.fetch = async () => Response.json(null, { status: 503 })
  await assert.rejects(inventory.createCopy('i3-resource', 'A'))
  globalThis.fetch = async () => Response.json({ id: 'B', recursoId: 'i3-resource', codigoInventario: 'B' })
  await inventory.createCopy('i3-resource', 'B')
  globalThis.fetch = async () => Response.json([])
  await inventory.getCopies('i3-resource'); assert.equal(guard.pendingMutation(inventory.copyIntent('i3-resource', 'A')), true)
  globalThis.fetch = async () => Response.json([{ id: 'A-real', recursoId: 'i3-resource', codigoInventario: 'A' }])
  await inventory.getCopies('i3-resource'); assert.equal(guard.pendingMutation(inventory.copyIntent('i3-resource', 'A')), false)
})
test('I4: montaje POST confirmado + F14 404 + confirmación humana cancela ID/owner reales', async () => {
  const component = await loadComponent('modules/loans/components/ReservationDialog')
  const calls = [], future = new Date(Date.now() + 600000).toISOString()
  const confirmed = { id: 'i4-reservation-real', userId: 'owner', copyId: 'i4-copy', status: 'CONFIRMADA', pickupDeadline: future }
  globalThis.fetch = async (url, options) => {
    calls.push([url, options.method])
    if (options.method === 'POST') return Response.json(confirmed, { status: 201 })
    if (options.method === 'DELETE') { assert.equal(url, '/api/loans/reservations/i4-reservation-real'); return Response.json({ ...confirmed, status: 'CANCELADA' }) }
    return Response.json(null, { status: 404 })
  }
  const mounted = mount(component, { copies: [{ id: 'i4-copy', estado: 'DISPONIBLE', codigoInventario: 'REAL' }], resourceName: 'Real' })
  try {
    await model(find(mounted.root, 'select'), 'i4-copy')
    await model(find(mounted.root, 'input'), future)
    await event(find(mounted.root, 'form'), 'submit')
    assert.match(text(mounted.root), /i4-reservation-real/)
    await assert.rejects(reservations.listReservations({ userId: 'owner' }), e => e.status === 404)
    await event(find(mounted.root, 'button', 'Cancelar esta reserva'), 'click')
    assert.equal(find(mounted.root, 'button', 'Confirmar cancelación').props.disabled, true)
    await model(findAll(mounted.root, n => n.tag === 'input' && n.props.type === 'checkbox')[0], true)
    await event(find(mounted.root, 'button', 'Confirmar cancelación'), 'click')
    assert.match(text(mounted.root), /Cancelación confirmada/)
    assert.equal(calls.filter(c => c[1] === 'DELETE').length, 1)
  } finally { mounted.unmount(); await flush() }
})
test('I4: cancelación de titular ajeno se rechaza sin red; resultado incierto no se duplica', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new TypeError('offline') }
  await assert.rejects(reservations.cancelReservation('i4-owned', '', 'other'), e => e.status === 403)
  assert.equal(calls, 0)
  await assert.rejects(reservations.cancelReservation('i4-owned', '', 'owner'), e => e.status === 0)
  await assert.rejects(reservations.cancelReservation('i4-owned', '', 'owner'), e => e.status === 0)
  assert.equal(calls, 1)
})
test('I5: reloj controlado rechaza futura/antedatada y conserva milisegundos actuales', () => {
  const now = Date.parse('2026-10-28T12:00:00.123Z'), starts = '2026-10-28T11:00:00Z'
  for (const delta of [-60000, -1, 1, 60000]) assert.throws(() => policy.returnInput(new Date(now + delta).toISOString(), false, '', starts, now))
  assert.equal(policy.returnInput(new Date(now).toISOString(), false, '', starts, now).returnedAt, new Date(now).toISOString())
})
test('I6: ida y retorno con categoría/disponibilidad/página en ambos orígenes y destino controlado', () => {
  const filters = { categoryId: 'cat & 1', available: 'false', page: '4', search: 'audio', limit: '10', returnTo: 'https://evil.invalid' }
  for (const management of [false, true]) {
    const detail = query.resourceDestination('r1', filters, management)
    assert.equal(detail.path, '/app/catalog/r1')
    const back = query.catalogDestination(detail.query, detail.query.origin === 'management')
    assert.equal(back.path, management ? '/app/admin/catalog' : '/app/catalog')
    assert.deepEqual(back.query, { categoryId: filters.categoryId, available: 'false', page: '4', search: 'audio', limit: '10' })
  }
  assert.equal(query.catalogDestination({ origin: '//evil.invalid' }).path, '/app/catalog')
})
test('I8: fuente global completa agrega categorías sin sumar prestados/reservados', async () => {
  const rows = [{ id: 'r1', categoriaId: 'c1', availableCopies: 2, disponibles: 2, prestados: 3, noDisponibles: 1 }, { id: 'r2', categoriaId: 'c1', availableCopies: 0, disponibles: 0, totalCopies: 0 }, { id: 'r3', categoriaId: 'c2', availableCopies: 4, disponibles: 4 }]
  globalThis.fetch = async url => { assert.equal(url, '/api/inventory/availability'); return Response.json(rows) }
  const all = await inventory.getGlobalAvailability()
  assert.equal(inventory.categoryAvailability(all, 'c1'), 2); assert.equal(inventory.categoryAvailability(all, 'c2'), 4)
  assert.equal(inventory.categoryAvailability(all, 'empty'), 0); assert.equal(inventory.categoryAvailability(null, 'c1'), null)
})
test('I8: errores e incompatibilidad dejan disponibilidad desconocida, no cero', async () => {
  for (const payload of [null, [], [{ id: 'r', categoriaId: 'c', availableCopies: -1 }]]) {
    if (Array.isArray(payload) && payload.length === 0) continue
    globalThis.fetch = async () => Response.json(payload)
    await assert.rejects(inventory.getGlobalAvailability(), e => e.status === 0)
  }
  const scope = effectScope(); let remote
  globalThis.fetch = async () => Response.json(null, { status: 503 })
  scope.run(() => { remote = useRemote(inventory.getGlobalAvailability) })
  await flush(); assert.equal(remote.data.value, null); assert.equal(inventory.categoryAvailability(remote.data.value, 'c'), null)
  scope.stop()
})
test('I9: F11 rechaza finalizada, calendario inválido y periodo invertido', () => {
  const good = detailedSanction({ id: 's', userId: 'owner', startsAt: '2026-10-28T00:00:00Z', endsAt: null, rule: rule({ suspensionType: 'INDEFINIDA', suspensionDays: null }) })
  assert.equal(trustContracts.validSuspension(good), true)
  for (const change of [{ status: 'FINALIZADA' }, { startsAt: '2026-02-30T00:00:00Z' }, { startsAt: 'invalid' }, { endsAt: '2026-01-01T00:00:00Z' }]) assert.equal(trustContracts.validSuspension({ ...good, ...change }), false)
})
test('I9: suspensión exige titular, estado y fechas de la acción; F05 exige ID solicitado', async () => {
  auth.saveSession(session('ADMINISTRADOR'))
  const body = { ruleId, reason: 'Fundamento', startsAt: new Date(Date.now() + 600000).toISOString(), endsAt: null }
  for (const [index, change] of [{ userId: 'other' }, { status: 'ACTIVA' }, { startsAt: '2025-01-01T00:00:00Z' }].entries()) {
    const userId = 'i9-' + index
    globalThis.fetch = async () => Response.json(detailedSanction({ id: 's', userId, status: 'PROGRAMADA', ...body, rule: rule({ suspensionType: 'INDEFINIDA', suspensionDays: null }), ...change }))
    await assert.rejects(trust.suspendUser(userId, body), e => e.status === 0)
  }
  globalThis.fetch = async () => Response.json({ id: 'other', status: 'ACTIVA', startsAt: body.startsAt, endsAt: null })
  await assert.rejects(trust.getSanction('requested'), e => e.status === 0)
})
test('I9: confirma únicamente suspensión activa/programada con periodo exacto y vigente', async () => {
  auth.saveSession(session('ADMINISTRADOR'))
  for (const [status, delta] of [['ACTIVA', -60000], ['PROGRAMADA', 60000]]) {
    const userId = 'i9-valid-' + status
    const startsAt = new Date(Date.now() + delta).toISOString()
    const body = { ruleId, reason: 'Fundamento', startsAt, endsAt: new Date(Date.parse(startsAt) + 7 * 86400000).toISOString() }
    globalThis.fetch = async () => Response.json(detailedSanction({ userId, status, startsAt: body.startsAt, endsAt: body.endsAt }))
    assert.equal((await trust.suspendUser(userId, body)).status, status)
  }
})

async function routerAt(path = '/app') {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/app', component: { render: () => null } },
    { path: '/app/catalog', component: { render: () => null } },
    { path: '/app/catalog/:resourceId', component: { render: () => null } },
    { path: '/app/admin/catalog', component: { render: () => null } },
    { path: '/app/reservations', component: { render: () => null } },
  ] })
  await router.push(path); await router.isReady(); return router
}
const sanction = id => ({ id, status: 'ACTIVA', startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: null, previousTrust: 100, resultingTrust: 95, violationId: 'v1', ruleId: 'rule' })
function studentReads(sanctionId, onAppeal) {
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') return onAppeal(url, options)
    if (url.endsWith('/sanctions')) return Response.json([sanction(sanctionId)])
    if (url.endsWith('/history')) return Response.json([{ id: 'loan', copyId: 'copy', status: 'ACTIVO', startsAt: new Date(Date.now() - 1000).toISOString(), endsAt: new Date(Date.now() + 60000).toISOString() }])
    if (url.endsWith('/categories')) return Response.json([{ id: 'cat', nombre: 'Cámaras', resourceCount: 5 }])
    if (url.endsWith('/availability')) return Response.json([{ id: 'resource', categoriaId: 'cat', availableCopies: 2 }])
    if (url.includes('/copies/')) return Response.json({ id: 'copy', codigoInventario: 'C-REAL', recurso: { id: 'resource', nombre: 'Cámara real' } })
    return Response.json({ id: 'owner', name: 'Nombre real', enabled: true, percentage: 95, level: 'CONFIABLE' })
  }
}
test('I2: montaje conserva texto ante incertidumbre y no muestra éxito ni permite duplicar', async () => {
  const component = await loadComponent('modules/users/pages/StudentAppPage'), router = await routerAt()
  let calls = 0
  studentReads('i2-mounted-unknown', async () => { calls++; throw new TypeError('offline') })
  const mounted = mount(component, {}, [router])
  try {
    await flush(); await flush()
    await event(find(mounted.root, 'button', 'Apelar sanción'), 'click')
    await model(find(mounted.root, 'textarea'), 'Mi fundamento sin perder')
    await event(findAll(mounted.root, n => n.tag === 'form').at(-1), 'submit')
    assert.equal(find(mounted.root, 'textarea').value, 'Mi fundamento sin perder')
    assert.equal(find(mounted.root, 'button', 'Enviar apelación').props.disabled, true)
    assert.doesNotMatch(text(mounted.root), /confirmada como PENDIENTE/)
    await event(findAll(mounted.root, n => n.tag === 'form').at(-1), 'submit')
    assert.equal(calls, 1)
    await event(find(mounted.root, 'button', 'Cancelar'), 'click')
    await event(find(mounted.root, 'button', 'Ver motivo del envío pendiente'), 'click')
    assert.equal(find(mounted.root, 'textarea').value, 'Mi fundamento sin perder')
    assert.equal(find(mounted.root, 'button', 'Enviar apelación').props.disabled, true)
  } finally { mounted.unmount(); await flush() }
})
test('I2: montaje muestra ID confirmado y deshabilita reapelación al remontar', async () => {
  const component = await loadComponent('modules/users/pages/StudentAppPage'), router = await routerAt()
  studentReads('i2-mounted-confirmed', async () => Response.json({ id: 'appeal-mounted-real', userId: 'owner', sanctionId: 'i2-mounted-confirmed', status: 'PENDIENTE' }))
  let mounted = mount(component, {}, [router])
  try {
    await flush(); await flush()
    await event(find(mounted.root, 'button', 'Apelar sanción'), 'click')
    await model(find(mounted.root, 'textarea'), 'Revisión real')
    await event(findAll(mounted.root, n => n.tag === 'form').at(-1), 'submit')
    assert.match(text(mounted.root), /appeal-mounted-real/)
    assert.equal(find(mounted.root, 'button', 'Apelar sanción').props.disabled, true)
    mounted.unmount(); await flush()
    mounted = mount(component, {}, [router]); await flush(); await flush()
    assert.equal(find(mounted.root, 'button', 'Apelar sanción').props.disabled, true)
  } finally { mounted.unmount(); await flush() }
})
test('I5: diálogo cruza vencimiento y envía instante de confirmación, sin fecha editable', async t => {
  const component = await loadComponent('modules/loans/components/ReturnLoanDialog')
  const original = Date.now; let now = Date.parse('2026-10-28T12:00:00.123Z')
  Date.now = () => now
  auth.saveSession(account('owner'))
  t.mock.timers.enable({ apis: ['setInterval'] })
  const loan = { id: 'i5-cross-deadline', userId: 'owner', copyId: 'copy', status: 'ACTIVO', startsAt: '2026-10-28T11:00:00Z', endsAt: '2026-10-28T12:00:01Z' }
  let body
  globalThis.fetch = async (_url, options) => { body = JSON.parse(options.body); return Response.json({ ...loan, status: 'FINALIZADO', return: { returnedAt: body.returnedAt } }) }
  const mounted = mount(component, { loan, copyLabel: 'Ejemplar real' })
  try {
    await flush()
    assert.match(text(mounted.root), /dentro del plazo/)
    assert.equal(findAll(mounted.root, n => n.tag === 'input' && n.props.type === 'datetime-local').length, 0)
    now += 2000; t.mock.timers.tick(2000); await flush()
    assert.match(text(mounted.root), /posterior al vencimiento/)
    assert.match(text(mounted.root), new RegExp(Intl.DateTimeFormat().resolvedOptions().timeZone))
    await event(find(mounted.root, 'form'), 'submit')
    assert.equal(body.returnedAt, new Date(now).toISOString())
  } finally { mounted.unmount(); Date.now = original; t.mock.timers.reset(); await flush() }
})
test('I1: diálogo devolución 401 libera dueño original al relogin', async () => {
  const component = await loadComponent('modules/loans/components/ReturnLoanDialog')
  const loan = { id: 'i1-mounted-return', userId: 'owner', copyId: 'copy', status: 'ACTIVO', startsAt: new Date(Date.now() - 10000).toISOString(), endsAt: new Date(Date.now() + 60000).toISOString() }
  globalThis.fetch = async () => Response.json(null, { status: 401 })
  const mounted = mount(component, { loan, copyLabel: 'Real' })
  try {
    await event(find(mounted.root, 'form'), 'submit')
    assert.equal(auth.getSession(), null)
    auth.saveSession(account('owner'))
    assert.equal(loans.hasPendingReturn(loan.id), false)
  } finally { mounted.unmount(); await flush() }
})
test('I6: enlaces montados y router real conservan filtros al ir y volver en ambos contextos', async () => {
  auth.saveSession({ ...account('owner'), user: { ...account('owner').user, role: 'ADMINISTRADOR' } })
  const Card = await loadComponent('modules/inventory/components/ResourceCard'), Detail = await loadComponent('modules/inventory/pages/ResourceDetailPage')
  for (const management of [false, true]) {
    const origin = management ? '/app/admin/catalog' : '/app/catalog'
    const router = await routerAt(origin + '?categoryId=cat&available=false&page=3')
    let mounted = mount(Card, { resource: { id: 'r1', nombre: 'Recurso real' }, management }, [router])
    let href = find(mounted.root, 'a').props.href
    assert.ok(href.includes('origin=' + (management ? 'management' : 'catalog')))
    mounted.unmount(); await flush(); await router.push(href)
    globalThis.fetch = async url => Response.json(url.endsWith('/copies') ? [] : { id: 'r1', nombre: 'Recurso real' })
    mounted = mount(Detail, {}, [router])
    try {
      await flush()
      assert.ok(findAll(mounted.root, n => n.props.class === 'detail-columns').length)
      assert.ok(findAll(mounted.root, n => n.tag === 'strong' && n.props.class === 'available-number').length)
      const back = find(mounted.root, 'a', 'Volver')
      await router.push(back.props.href)
      assert.equal(router.currentRoute.value.path, origin)
      assert.deepEqual(router.currentRoute.value.query, { categoryId: 'cat', available: 'false', page: '3' })
    } finally { mounted.unmount(); await flush() }
  }
})
test('I7/I8: inicio montado tiene tabla de escritorio, tarjetas móviles, contador y disponibilidad distinta de recursos', async () => {
  const component = await loadComponent('modules/users/pages/StudentAppPage'), router = await routerAt()
  studentReads('i7-sanction', async () => { throw new Error('No mutar') })
  const mounted = mount(component, {}, [router])
  try {
    await flush(); await flush()
    assert.match(text(mounted.root).replace(/\s+/g, ' '), /5 recursos registrados/)
    assert.match(text(mounted.root).replace(/\s+/g, ' '), /2 ejemplares disponibles/)
    assert.ok(find(mounted.root, 'table', 'Cámara real'))
    assert.ok(findAll(mounted.root, n => n.tag === 'article' && n.props.class?.includes('mobile-only')).length)
    assert.match(text(find(mounted.root, 'h2', 'Mis préstamos activos').parent), /1 activos/)
  } finally { mounted.unmount(); await flush() }
})
test('I7: layout montado mantiene marca en sidebar y cabecera solamente sobre contenido', async () => {
  const component = await loadComponent('shared/layouts/AppLayout'), router = await routerAt()
  const mounted = mount(component, {}, [router])
  try {
    const nav = find(mounted.root, 'nav'), header = find(mounted.root, 'header')
    assert.ok(find(nav, 'strong', 'CS Préstamos'))
    assert.equal(header.parent.props.class, 'content-shell')
    assert.equal(nav.parent, header.parent.parent)
    assert.match(text(header), /owner|test@example.invalid/)
  } finally { mounted.unmount(); await flush() }
})
test('I7: inventario montado ofrece tabla desktop y tarjetas móviles con las mismas acciones reales', async () => {
  const component = await loadComponent('modules/inventory/pages/CatalogPage'), router = await routerAt('/app/admin/catalog')
  globalThis.fetch = async url => Response.json(url.includes('/categories') ? [{ id: 'cat', nombre: 'Categoría real' }] : { data: [{ id: 'real', nombre: 'Recurso real', categoriaId: 'cat', availableCopies: 2, totalCopies: 3 }], total: 1, page: 1, limit: 20 })
  const mounted = mount(component, { management: true }, [router])
  try {
    await flush(); await flush()
    assert.ok(find(mounted.root, 'table', 'Recurso real'))
    assert.ok(findAll(mounted.root, n => n.tag === 'div' && n.props.class?.includes('mobile-only')).length)
    assert.equal(findAll(mounted.root, n => n.tag === 'button' && text(n).includes('Editar artículo y ejemplares')).length, 2)
    assert.equal(findAll(mounted.root, n => n.props.class === 'resource-picture').length, 0)
  } finally { mounted.unmount(); await flush() }
})
test('I7: usuarios montados conservan tabla desktop y tarjetas móviles sin inventar teléfono', async () => {
  const component = await loadComponent('modules/users/pages/UsersManagementPage')
  globalThis.fetch = async () => Response.json({ items: [{ id: 'real', name: 'Persona real', institutionalId: 'I-REAL', userType: 'DOCENTE', hasCurrentAffiliation: true, trustPercentage: 98 }], total: 1 })
  const mounted = mount(component)
  try {
    await flush(); await flush()
    assert.ok(find(mounted.root, 'table', 'Persona real'))
    assert.ok(find(mounted.root, 'article', 'Persona real'))
    assert.match(text(mounted.root), /teléfono no disponible/)
    assert.equal(findAll(mounted.root, n => n.tag === 'button' && text(n).trim() === 'Historial').length, 2)
  } finally { mounted.unmount(); await flush() }
})
test('I7: formulario montado alterna visibilidad accesible sin enviar ni alterar contraseña', async () => {
  const component = await loadComponent('modules/auth/components/FullRegistrationForm')
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('No debe enviar') }
  const mounted = mount(component)
  try {
    const password = findAll(mounted.root, n => n.tag === 'input' && n.props.id === 'registration-password')[0]
    await model(password, 'offline-test-password')
    await event(find(mounted.root, 'button', 'Mostrar contraseña'), 'click')
    assert.equal(password.props.type, 'text'); assert.equal(password.value, 'offline-test-password')
    assert.equal(find(mounted.root, 'button', 'Ocultar contraseña').props['aria-pressed'], true)
    await event(find(mounted.root, 'button', 'Ocultar contraseña'), 'click')
    assert.equal(password.props.type, 'password'); assert.equal(calls, 0)
  } finally { mounted.unmount(); await flush() }
})
