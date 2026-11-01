import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryHistory, createRouter } from 'vue-router'
import { load, loadModule, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, text } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const { historyState } = await loadModule('modules/loans/pages/MyHistoryPage')
const Page = await loadComponent('modules/loans/pages/MyHistoryPage')
beforeEach(testEnvironment)

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
]

const resourceNames = { c1: 'Álgebra lineal', c2: 'Cálculo diferencial', c3: 'Física universitaria', c4: 'Historia de Perú' }

function mockFetch(history = fixture) {
  globalThis.fetch = async (url) => {
    const path = String(url)
    if (path.includes('/history')) return Response.json(history)
    const id = path.split('/inventory/copies/')[1]
    return Response.json({ id, recursoId: 'r-' + id, codigoInventario: 'INV-' + id.length + id.charCodeAt(0), estado: 'PRESTADO', recurso: { id: 'r-' + id, nombre: resourceNames[id] ?? 'Recurso', categoriaId: 'cat' } })
  }
}

async function openPage() {
  auth.saveSession(session('USUARIO'))
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push('/app/history')
  await router.isReady()
  return { ...mount(Page, {}, [router]), router }
}

test('mi historial: tarjetas con recursos, fechas, orden reciente y etiquetas de estado', async () => {
  mockFetch()
  const app = await openPage()
  try {
    await flush(); await flush()
    assert.match(text(app.root), /Mi historial/)
    const cards = findAll(app.root, n => n.tag === 'article')
    assert.equal(cards.length, 4)
    // Más reciente primero: startsAt descendente.
    const names = cards.map(card => text(find(card, 'h2')))
    assert.deepEqual(names, ['Historia de Perú', 'Física universitaria', 'Cálculo diferencial', 'Álgebra lineal'])
    assert.match(text(cards[0]), /Programado/)
    assert.match(text(cards[1]), /Activo/)
    assert.match(text(cards[2]), /Vencido/)
    assert.match(text(cards[3]), /Devuelto/)
    assert.match(text(cards[3]), /Devolución/)
    assert.equal(text(cards[1]).includes('Devolución'), false)
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
    assert.deepEqual(counts(), { Todos: 4, Activos: 1, Vencidos: 1, Devueltos: 1, Programados: 1 })
    await event(find(app.root, 'button', 'Vencidos'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 1)
    assert.match(text(app.root), /Vencido/)
    assert.equal(find(app.root, 'button', 'Vencidos').props['aria-pressed'], true)
    await event(find(app.root, 'button', 'Devueltos'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 1)
    assert.match(text(find(app.root, 'article')), /Devuelto/)
  } finally { app.unmount(); await flush() }
})

test('mi historial: vacío amable con enlace al catálogo; error con reintento', async () => {
  mockFetch([])
  const app = await openPage()
  try {
    await flush(); await flush()
    assert.match(text(app.root), /Aún no tienes préstamos/)
    const link = find(app.root, 'a', 'Explora el catálogo')
    assert.ok(link)
    assert.equal(link.props.href ?? link.props.to, '/app/catalog')
    assert.match(text(app.root), /Todos \(0\)/)
  } finally { app.unmount(); await flush() }

  let calls = 0
  globalThis.fetch = async () => { calls++; throw new TypeError('offline') }
  const failing = await openPage()
  try {
    await flush(); await flush()
    assert.match(text(find(failing.root, 'div', 'Volver a intentar')), /No pudimos comunicarnos/)
    globalThis.fetch = async () => { calls++; return Response.json([]) }
    await event(find(failing.root, 'button', 'Volver a intentar'), 'click'); await flush()
    assert.equal(calls, 2)
    assert.match(text(failing.root), /Aún no tienes préstamos/)
  } finally { failing.unmount(); await flush() }
})

test('mi historial: un filtro sin resultados no borra los datos subyacentes', async () => {
  mockFetch(fixture.slice(0, 1))
  const app = await openPage()
  try {
    await flush(); await flush()
    await event(find(app.root, 'button', 'Vencidos'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 0)
    assert.match(text(app.root), /No hay préstamos en este estado/)
    await event(find(app.root, 'button', 'Todos'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'article').length, 1)
  } finally { app.unmount(); await flush() }
})
