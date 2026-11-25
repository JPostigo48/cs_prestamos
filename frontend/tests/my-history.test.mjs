import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { activeLoan, closedLoan, requestId } from './helpers/loan-closure-fixtures.mjs'
import { createMemoryHistory, createRouter } from 'vue-router'
import { load, loadModule, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, text } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const { historyState } = await loadModule('modules/loans/pages/MyHistoryPage')
const Page = await loadComponent('modules/loans/pages/MyHistoryPage')
const { combineHistory, getPersonalReservations } = await load('modules/loans/personal-history')
const { dateTime } = await load('shared/format')
beforeEach(testEnvironment)
test('fecha compacta conserva America/Lima, cruce de día y omite segundos y etiqueta', () => {
  const instant = '2026-11-18T02:03:47Z'
  assert.equal(dateTime(instant), new Date(instant).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
  assert.doesNotMatch(dateTime(instant), /Lima|:47/)
  assert.match(dateTime(instant), /17/)
  assert.equal(dateTime('inválida'), 'Fecha no disponible')
})

const now = Date.parse('2026-06-15T12:00:00.000Z')
const loan = (status, endsAt) => ({ status, endsAt })

test('historial: Vencido, Activo, Devuelto y Programado según estado y fecha', () => {
  assert.equal(historyState(loan('FINALIZADO', '2026-01-01T00:00:00.000Z'), now), 'DEVUELTO')
  assert.equal(historyState(loan('PLANIFICADO', '2026-01-01T00:00:00.000Z'), now), 'PROGRAMADO')
  assert.equal(historyState(loan('ACTIVO', '2026-06-15T11:59:59.999Z'), now), 'VENCIDO')
  assert.equal(historyState(loan('ACTIVO', '2026-06-15T12:00:00.000Z'), now), 'ACTIVO')
  assert.equal(historyState(loan('ACTIVO', '2026-07-01T00:00:00.000Z'), now), 'ACTIVO')
  // Un finalizado vencido sigue siendo Devuelto; un planificado vencido sigue Programado.
  assert.equal(historyState(loan('FINALIZADO', '2020-01-01T00:00:00.000Z'), now), 'DEVUELTO')
  assert.equal(historyState(loan('PLANIFICADO', '2020-01-01T00:00:00.000Z'), now), 'PROGRAMADO')
})

const futureIso = (days) => new Date(Date.now() + days * 86400000).toISOString()
const fixture = [
  { id: 'l-old', copyId: 'c1', startsAt: futureIso(-30), endsAt: futureIso(-23), status: 'FINALIZADO', return: { returnedAt: futureIso(-24) } },
  { id: 'l-overdue', copyId: 'c2', startsAt: futureIso(-10), endsAt: futureIso(-3), status: 'ACTIVO', return: null },
  { id: 'l-active', copyId: 'c3', startsAt: futureIso(-2), endsAt: futureIso(5), status: 'ACTIVO', return: null },
  { id: 'l-planned', copyId: 'c4', startsAt: futureIso(7), endsAt: futureIso(14), status: 'PLANIFICADO', return: null },
].map(item => ({ ...item, userId: session().user.id, configurationSnapshot: null, returnChecklist: null }))

const resourceNames = { c1: 'Álgebra lineal', c2: 'Cálculo diferencial', c3: 'Física universitaria', c4: 'Historia de Perú' }

function mockFetch(history = fixture) {
  globalThis.fetch = async (url) => {
    const path = String(url)
    if (path.includes('/loans/reservations')) return Response.json({ items: [], total: 0, page: 1, limit: 100 })
    if (path.includes('/history')) return Response.json(history)
    const id = path.split('/inventory/copies/')[1]
    return Response.json({ id, recursoId: 'r-' + id, condicionFisica: 'APTO', habilitado: true, codigoInventario: 'INV-' + id.length + id.charCodeAt(0), estado: 'PRESTADO', recurso: { id: 'r-' + id, nombre: resourceNames[id] ?? 'Recurso', categoriaId: 'cat' } })
  }
}

for (const kind of ['PERDIDA', 'ROBO']) test(`historial ${kind}: terminal no es activo, vencido ni devuelto; aparece en Finalizados sin devolución ficticia`, async () => {
  auth.saveSession(session())
  const result = closedLoan(activeLoan('incident-history'), { requestId, kind, confirmed: true, description: 'Hecho acreditado', evidenceIds: [] })
  mockFetch([result])
  const app = mount(Page)
  try {
    await flush(); await flush()
    assert.equal(historyState(result, Date.now()), 'CERRADO_POR_INCIDENCIA')
    assert.match(text(app.root), /cerrado por incidencia · no devuelto/)
    assert.match(text(app.root), kind === 'ROBO' ? /Robo: cierre sin devolución real/ : /Pérdida: cierre sin devolución real/)
    assert.doesNotMatch(text(app.root), /Préstamo devuelto|Devuelto el/)
    await event(find(app.root, 'button', 'Finalizados'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 1)
    await event(find(app.root, 'button', 'En préstamo'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 0)
  } finally { app.unmount() }
})

for (const role of ['USUARIO', 'OPERADOR', 'ADMINISTRADOR']) test(`reservas y préstamos propios ${role}: consultas limitadas a la cuenta, sin acciones staff`, async () => {
  auth.saveSession(session(role))
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push([url, options.method])
    return Response.json(url.includes('/loans/reservations') ? { items: [], total: 0, page: 1, limit: 100 } : [])
  }
  const app = mount(Page)
  try {
    await flush()
    assert.match(text(app.root), /Mis reservas y préstamos/)
    assert.equal(find(app.root, 'button', 'Consultar'), undefined)
    assert.equal(calls.length, 2)
    assert.equal(calls[0][0], '/api/loans/user/' + session(role).user.id + '/history')
    const query = new URL(calls[1][0], 'https://offline.invalid').searchParams
    assert.equal(query.get('userId'), session(role).user.id)
    assert.equal(query.get('status'), null)
    assert.equal(calls.every(([, method]) => method === 'GET'), true)
    assert.equal(find(app.root, 'button', 'Entregar'), undefined)
  } finally { app.unmount() }
})

async function openPage() {
  auth.saveSession(session('USUARIO'))
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push('/app/history')
  await router.isReady()
  return { ...mount(Page, {}, [router]), router }
}

test('reservas: carga todas las páginas sin filtro; unión solo por vínculo real, estados y contadores sin duplicados', async () => {
  auth.saveSession(session('USUARIO'))
  const queries = []
  const reservation = { id: 'expired-reservation', userId: session().user.id, copyId: 'c1', status: 'VENCIDA',
    requestedAt: futureIso(-2), pickupDeadline: futureIso(-1), configurationSnapshot: null, loanId: null }
  const linked = { ...reservation, id: 'linked', status: 'RECOGIDA', loanId: 'l-old', pickedUpAt: futureIso(-3) }
  const converted = { ...linked, id: 'missing-link', loanId: null }
  const all = [...Array.from({ length: 100 }, (_, i) => ({ ...reservation, id: 'r-' + i })), linked, converted]
  globalThis.fetch = async url => {
    const path = String(url)
    if (path.includes('/loans/reservations')) {
      const query = new URL(path, 'https://offline.invalid').searchParams
      queries.push(query)
      const page = Number(query.get('page'))
      return Response.json({ items: all.slice((page - 1) * 100, page * 100), total: all.length, page, limit: 100 })
    }
    if (path.includes('/history')) return Response.json([fixture[0]])
    return Response.json({ id: 'c1', recursoId: 'r1', condicionFisica: 'APTO', habilitado: true, codigoInventario: 'INV-1', estado: 'DISPONIBLE', recurso: { id: 'r1', nombre: 'Libro', categoriaId: 'cat' } })
  }
  const app = await openPage()
  try {
    await flush()
    await flush()
    assert.equal(queries.length, 2)
    assert.equal(queries.at(-1).get('page'), '2')
    assert.equal(queries.at(-1).get('status'), null)
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 102)
    assert.match(text(app.root), /Originado en tu reserva/)
    assert.match(text(app.root), /Reserva convertida a préstamo/)
    assert.match(text(app.root), /Préstamo devuelto/)
    const beforeFocus = queries.length
    window.dispatchEvent(new Event('focus'))
    await flush()
    assert.equal(queries.length, beforeFocus)
    await event(find(app.root, 'button', 'Vencidos'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 100)
    assert.match(text(app.root), /Reserva · vencida sin recoger/)
    assert.equal(queries.at(-1).get('userId'), session().user.id)
    assert.equal(find(app.root, 'button', 'Cancelar reserva'), undefined)
    assert.equal(combineHistory([fixture[0]], [{ ...linked, loanId: null }]).length, 2)
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(getPersonalReservations(session().user.id, controller.signal), /abort/i)
  } finally {
    app.unmount()
    const afterUnmount = queries.length
    window.dispatchEvent(new Event('focus'))
    await flush()
    assert.equal(queries.length, afterUnmount)
  }
})

test('mi historial: tarjetas con recursos, fechas, orden reciente y etiquetas de estado', async () => {
  mockFetch()
  const app = await openPage()
  try {
    await flush(); await flush()
    assert.match(text(app.root), /Mis reservas y préstamos/)
    const cards = findAll(app.root, n => n.tag === 'article')
    assert.equal(cards.length, 4)
    // Más reciente primero: startsAt descendente.
    const names = cards.map(card => text(find(card, 'h2')))
    assert.deepEqual(names, ['Historia de Perú', 'Física universitaria', 'Cálculo diferencial', 'Álgebra lineal'])
    assert.match(text(cards[0]), /Préstamo programado/)
    assert.match(text(cards[1]), /Préstamo activo/)
    assert.match(text(cards[2]), /Préstamo vencido/)
    assert.match(text(cards[3]), /Préstamo devuelto/)
    assert.match(text(cards[3]), /Devuelto el/)
    assert.match(text(cards[1]), /Devolución límite/)
    // Sin IDs técnicos a la vista.
    assert.equal(text(app.root).includes('l-overdue'), false)
    assert.equal(text(app.root).includes('r-c2'), false)
  } finally { app.unmount(); await flush() }
})

test('mi historial: filtros con contador, estado vacío y sin resultados por filtro', async () => {
  mockFetch()
  const app = await openPage()
  try {
    await flush(); await flush()
    const counts = () => Object.fromEntries(
      findAll(app.root, n => n.tag === 'button' && /\(\d+\)/.test(text(n)))
        .map((button) => {
          const match = text(button).trim().match(/^(.+?) \((\d+)\)$/)
          return [match[1], Number(match[2])]
        }),
    )
    assert.deepEqual(counts(), { 'Todo el historial': 4, 'Por recoger': 0, 'En préstamo': 2, Vencidos: 1, Finalizados: 1 })
    await event(find(app.root, 'button', 'Vencidos'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 1)
    assert.match(text(app.root), /Préstamo vencido/)
    assert.equal(find(app.root, 'button', 'Vencidos').props['aria-pressed'], true)
    await event(find(app.root, 'button', 'Finalizados'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 1)
    assert.match(text(find(app.root, 'article')), /Préstamo devuelto/)
  } finally { app.unmount(); await flush() }
})

test('mi historial: vacío amable con enlace al catálogo; error con reintento', async () => {
  mockFetch([])
  const app = await openPage()
  try {
    await flush(); await flush()
    assert.match(text(app.root), /Aún no tienes reservas ni préstamos/)
    const link = find(app.root, 'a', 'Explora el catálogo')
    assert.ok(link)
    assert.equal(link.props.href ?? link.props.to, '/app/catalog')
    assert.match(text(app.root), /Todo el historial \(0\)/)
  } finally { app.unmount(); await flush() }

  let calls = 0
  globalThis.fetch = async () => { calls++; throw new TypeError('offline') }
  const failing = await openPage()
  try {
    await flush(); await flush()
    assert.match(text(find(failing.root, 'div', 'Volver a intentar')), /No pudimos comunicarnos/)
    globalThis.fetch = async url => { calls++; return Response.json(String(url).includes('/reservations') ? { items: [], total: 0, page: 1, limit: 100 } : []) }
    await event(find(failing.root, 'button', 'Volver a intentar'), 'click'); await flush()
    assert.equal(calls, 3)
    assert.doesNotMatch(text(failing.root), /Aún no tienes/)
    await event(find(failing.root, 'button', 'Volver a intentar'), 'click'); await flush()
    assert.equal(calls, 4)
    assert.match(text(failing.root), /Aún no tienes reservas ni préstamos/)
  } finally { failing.unmount(); await flush() }
})

test('mi historial: un filtro sin resultados no borra los datos subyacentes', async () => {
  mockFetch(fixture.slice(0, 1))
  const app = await openPage()
  try {
    await flush(); await flush()
    await event(find(app.root, 'button', 'Vencidos'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 0)
    assert.match(text(app.root), /No hay operaciones en este estado/)
    await event(find(app.root, 'button', 'Todo el historial'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 1)
  } finally { app.unmount(); await flush() }
})

test('historial: carga visible sin clic y cancelar recarga ambas fuentes sin repetir la mutación', async () => {
  auth.saveSession(session())
  let releaseReservations, reads = 0, writes = 0, cancelled = false
  const reservation = { id: 'cancel-ux', userId: session().user.id, copyId: 'copy-ux', status: 'CONFIRMADA',
    requestedAt: futureIso(1), pickupDeadline: futureIso(2), loanId: null, configurationSnapshot: null }
  globalThis.fetch = async (url, options) => {
    if (options.method === 'DELETE') { writes++; cancelled = true; return Response.json({ ...reservation, status: 'CANCELADA', cancelledAt: futureIso(0) }) }
    if (String(url).includes('/reservations')) {
      reads++
      if (!releaseReservations) await new Promise(resolve => { releaseReservations = resolve })
      return Response.json({ items: [{ ...reservation, ...(cancelled ? { status: 'CANCELADA', cancelledAt: futureIso(0) } : {}) }], total: 1, page: 1, limit: 100 })
    }
    if (String(url).includes('/history')) { reads++; return Response.json([]) }
    return Response.json({ id: 'copy-ux', condicionFisica: 'APTO', habilitado: true, codigoInventario: 'UX', recurso: { id: 'resource-ux', nombre: 'Recurso UX' } })
  }
  const app = mount(Page)
  try {
    assert.match(text(app.root), /Cargando/)
    await flush(); releaseReservations(); await flush(); await flush()
    await event(find(app.root, 'button', 'Cancelar reserva'), 'click')
    await event(find(app.root, 'form'), 'submit')
    assert.equal(writes, 1)
    assert.equal(reads, 4)
    assert.match(text(app.root), /Reserva cancelada/)
  } finally { app.unmount(); releaseReservations?.() }
})
