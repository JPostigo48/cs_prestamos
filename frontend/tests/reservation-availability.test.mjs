import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryHistory, createRouter } from 'vue-router'
import { load, loadComponent, session, testEnvironment } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model, text } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const Detail = await loadComponent('modules/inventory/pages/ResourceDetailPage')
const owner = session().user.id
const copy = { id: 'copy-availability', codigoInventario: 'C-1', estado: 'DISPONIBLE', recursoId: 'resource' }
const category = { id: 'category', nombre: 'Libros', tiempoMaximoPrestamoDias: 1, tiempoMaximoPrestamoHoras: 24 }
const resource = { id: 'resource', categoriaId: category.id, categoria: category, nombre: 'Libro', descripcion: null, available: true,
  loanPolicy: { resourceId: 'resource', categoryId: category.id, durationHours: null, effectiveDurationHours: 24, source: 'CATEGORY' } }
const reservation = { id: 'reservation-open', userId: owner, copyId: 'another-copy', status: 'CONFIRMADA',
  requestedAt: '2099-01-01T10:00:00Z', pickupDeadline: '2099-01-01T10:30:00Z', configurationSnapshot: null }
const loan = (status = 'ACTIVO', userId = owner) => ({ id: 'loan-open', copyId: 'another-copy', userId, status,
  startsAt: '2020-01-01T10:00:00Z', endsAt: '2020-01-01T12:00:00Z', configurationSnapshot: null, returnChecklist: null, return: null })
const settings = { pickupWaitMinutes: 30, weeklySchedule: null, version: 1, updatedAt: '2026-11-04T00:00:00Z',
  timeZone: 'America/Lima', scheduleStatus: 'UNCONFIGURED', pickupWindowPolicy: 'FULL_WINDOW_WITHIN_INTERVAL', warning: 'Horario sin configurar.' }

async function openDetail(state = {}, role = 'USUARIO') {
  testEnvironment()
  auth.saveSession(session(role))
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.includes('/loans/reservations?')) {
      if (state.reservationFailure) return Response.json({}, { status: 500 })
      const parsed = new URL(url, 'http://localhost')
      assert.equal(parsed.searchParams.get('userId'), owner)
      assert.equal(parsed.searchParams.get('status'), 'CONFIRMADA')
      const items = state.reserved ? [reservation] : []
      return Response.json({ items, total: items.length, page: 1, limit: 1 })
    }
    if (url.includes('/loans/user/')) {
      assert.equal(url, `/api/loans/user/${owner}/history`)
      if (state.waitForLoans) await state.waitForLoans
      if (state.loanFailure) return Response.json({}, { status: 503 })
      return Response.json(state.loans ?? [])
    }
    if (url.endsWith('/system/reservation-settings')) return Response.json(settings)
    if (url.endsWith('/loans/reservations') && options.method === 'POST') {
      state.reserved = true
      const input = JSON.parse(options.body)
      return Response.json({ ...reservation, copyId: input.copyId, requestedAt: input.requestedAt })
    }
    if (url.includes('/loans/resource/')) return Response.json({ items: [], total: 0, page: 1, limit: 20 })
    if (url.endsWith('/accessories')) return Response.json({ items: [] })
    if (url.endsWith('/copies')) return Response.json(state.noCopies ? [] : [copy])
    return Response.json(resource)
  }
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/app/catalog/:resourceId', component: { render: () => null } },
    { path: '/app/catalog', component: { render: () => null } },
    { path: '/app/terms', component: { render: () => null } },
  ] })
  await router.push('/app/catalog/resource')
  const app = mount(Detail, {}, [router])
  await flush()
  return { app, calls, button: () => find(app.root, 'button', 'Reservar ejemplar') }
}

for (const [label, state] of [
  ['reserva confirmada', { reserved: true }],
  ['préstamo activo, incluso vencido por fecha', { loans: [loan()] }],
  ['préstamo pendiente de entrega', { loans: [loan('PLANIFICADO')] }],
]) test(`bloquea reservar con ${label} de otro ejemplar`, async () => {
  const { app, button } = await openDetail(state)
  try {
    assert.equal(button().props.disabled, true)
    assert.match(text(app.root), /Ya tienes una (reserva|préstamo)|Ya tienes un préstamo/)
    await event(button(), 'click')
    assert.equal(find(app.root, 'dialog'), undefined)
  } finally { app.unmount() }
})

test('historial finalizado y ausencia de reservas confirmadas permiten reservar; el texto usa ejemplar', async () => {
  const { app, button } = await openDetail({ loans: [loan('FINALIZADO')] })
  try {
    assert.equal(button().props.disabled, false)
    assert.doesNotMatch(text(app.root), /Reservar equipo para mí/)
    await event(button(), 'click')
    await flush()
    assert.match(text(find(app.root, 'dialog')), /Reservar ejemplar/)
  } finally { app.unmount() }
})

test('sin ejemplares disponibles sigue bloqueado aunque no tenga operaciones', async () => {
  const { app, button } = await openDetail({ noCopies: true })
  try { assert.equal(button().props.disabled, true) } finally { app.unmount() }
})

for (const state of [{ reservationFailure: true }, { loanFailure: true }, { loans: [loan('ACTIVO', 'another-user')] }])
  test(`consulta fallida o ajena nunca habilita el botón: ${JSON.stringify(state)}`, async () => {
    const { app, button } = await openDetail(state)
    try {
      assert.equal(button().props.disabled, true)
      assert.match(text(app.root), /No pudimos comprobar tus operaciones/)
      state.reservationFailure = false
      state.loanFailure = false
      state.loans = []
      await event(find(app.root, 'button', 'Actualizar disponibilidad'), 'click')
      await flush()
      assert.equal(button().props.disabled, false)
    } finally { app.unmount() }
  })

test('permanece bloqueado mientras carga y revalida antes de abrir el modal', async () => {
  let release
  const state = { waitForLoans: new Promise(resolve => { release = resolve }) }
  const { app, button } = await openDetail(state)
  try {
    assert.equal(button().props.disabled, true)
    release()
    await flush()
    assert.equal(button().props.disabled, false)
    state.reserved = true
    await event(button(), 'click')
    await flush()
    assert.equal(button().props.disabled, true)
    assert.equal(find(app.root, 'dialog'), undefined)
    state.reserved = false
    window.dispatchEvent(new Event('focus'))
    await flush()
    assert.equal(button().props.disabled, false)
  } finally { app.unmount() }
})

test('confirmar una reserva actualiza el bloqueo sin abandonar la página', async () => {
  const state = {}
  const { app, calls, button } = await openDetail(state)
  try {
    await event(button(), 'click')
    await flush()
    const dialog = find(app.root, 'dialog')
    await model(find(dialog, 'select'), copy.id)
    await event(find(dialog, 'form'), 'submit')
    await flush()
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 1)
    assert.equal(state.reserved, true)
    assert.equal(button().props.disabled, true)
    await event(findAll(dialog, node => node.tag === 'button' && text(node) === 'Cerrar')[0], 'click')
    await flush()
    assert.equal(button().props.disabled, true)
  } finally { app.unmount() }
})
