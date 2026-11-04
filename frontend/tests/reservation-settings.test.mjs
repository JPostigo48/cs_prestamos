import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, find, findAll, text, event, model, flush } from './helpers/renderer.mjs'

const time = await load('modules/system/reservation-time')
const auth = await load('modules/auth/api/auth-api')
const policy = await load('modules/auth/access-policy')
const api = await load('modules/system/api/reservation-settings-api')
const Dialog = await loadComponent('modules/loans/components/ReservationDialog')
const Page = await loadComponent('modules/system/pages/SystemSettingsPage')
const Hint = await loadComponent('shared/components/AlertHint')
const settings = (weeklySchedule = null) => ({ pickupWaitMinutes: 30, weeklySchedule, version: 1, updatedAt: '2026-11-04T00:00:00Z', timeZone: 'America/Lima', scheduleStatus: weeklySchedule ? 'CONFIGURED' : 'UNCONFIGURED', pickupWindowPolicy: 'FULL_WINDOW_WITHIN_INTERVAL', warning: weeklySchedule ? null : 'Horario sin configurar; consulta la disponibilidad con el personal.' })
const week = () => Array.from({ length: 7 }, (_, i) => ({ day: i + 1, intervals: [{ opens: '08:00', closes: '12:00' }, { opens: '13:00', closes: '18:00' }] }))
const input = (root, type) => findAll(root, n => n.tag === 'input' && n.props.type === type)[0]
function setup(role = 'USUARIO') { testEnvironment(); auth.saveSession(session(role)) }
const copies = [{ id: 'copy-settings', estado: 'DISPONIBLE', codigoInventario: 'C1' }]

test('Lima, presets futuros redondeados y cruce de medianoche sin zona del dispositivo', () => {
  const now = Date.parse('2026-11-05T04:59:40Z')
  assert.deepEqual(time.limaParts(now), { date: '2026-11-04', time: '23:59' })
  for (const delay of [1, 10, 60]) {
    const p = time.futurePreset(now, delay)
    assert.equal(p.date, '2026-11-05')
    assert.ok(Date.parse(time.limaInstant(p.date, p.time)) >= now + delay * 60000)
  }
  assert.equal(time.limaInstant('2026-02-30', '10:00'), null)
  assert.equal(time.limaInstant('2026-11-04', '24:00'), null)
})
test('ventana completa: apertura inclusiva, cierre final inclusivo, sin sumar franjas', () => {
  const s = settings(week()), now = Date.parse('2026-11-04T05:00:00Z')
  for (const hour of ['08:00', '11:30', '17:30']) assert.equal(time.reservationTimeError('2026-11-04', hour, s, now), '')
  for (const hour of ['07:59', '11:31', '12:00', '12:45', '17:31', '18:00', '23:59']) assert.match(time.reservationTimeError('2026-11-04', hour, s, now), /misma franja/)
  s.weeklySchedule[2].intervals = []
  assert.match(time.reservationTimeError('2026-11-04', '10:00', s, now), /no hay atención/)
  assert.match(time.reservationTimeError('2026-11-04', '00:00', s, now), /futura/)
  assert.equal(time.reservationTimeError('2026-11-04', '23:59', settings(), now), '')
})
test('semana y espera: siete días, límites, contiguas, orden y solapamiento', () => {
  for (const value of [0, 241, 1.5, NaN]) assert.ok(time.waitError(value))
  for (const value of [1, 30, 240]) assert.equal(time.waitError(value), '')
  assert.ok(time.scheduleError([]))
  const w = week(); w[0].intervals = [{ opens: '08:00', closes: '09:00' }, { opens: '09:00', closes: '10:00' }]
  assert.equal(time.scheduleError(w), '')
  w[0].intervals[1].opens = '08:59'; assert.ok(time.scheduleError(w))
  w[0].intervals = [{ opens: '9:00', closes: '10:00' }]; assert.ok(time.scheduleError(w))
  w[0].intervals = Array.from({ length: 13 }, () => ({ opens: '08:00', closes: '09:00' })); assert.ok(time.scheduleError(w))
  assert.equal(time.scheduleError(week().map(d => ({ ...d, intervals: [] }))), '')
})
test('modal: hoy Lima, presets al clic, edición manual intacta y reloj invalida sin enviar', async t => {
  let now = Date.parse('2026-11-04T15:00:20Z')
  t.mock.method(Date, 'now', () => now)
  setup()
  auth.saveSession({ ...session(), expiresAt: Date.parse('2099-01-01T00:00:00Z') })
  t.mock.timers.enable({ apis: ['setInterval'] })
  let posts = 0
  globalThis.fetch = async (_url, options) => { if (options.method === 'POST') posts++; return Response.json(settings()) }
  const app = mount(Dialog, { copies, resourceName: 'Equipo' })
  try {
    await flush()
    assert.equal(input(app.root, 'date').value, '2026-11-04')
    assert.equal(input(app.root, 'time').value, '10:02')
    await model(find(app.root, 'select'), copies[0].id)
    await model(input(app.root, 'date'), '2026-11-06')
    await model(input(app.root, 'time'), '16:35')
    now += 60000; t.mock.timers.tick(1000); await flush()
    assert.equal(input(app.root, 'date').value, '2026-11-06')
    assert.equal(input(app.root, 'time').value, '16:35')
    now = Date.parse('2026-11-05T04:59:40Z')
    for (const [label, delay] of [['En 1 minuto', 1], ['En 10 minutos', 10], ['En 1 hora', 60]]) {
      await event(find(app.root, 'button', label), 'click')
      assert.equal(input(app.root, 'date').value, '2026-11-05')
      assert.equal(input(app.root, 'time').value, time.futurePreset(now, delay).time)
    }
    await model(input(app.root, 'date'), '2026-11-04'); await model(input(app.root, 'time'), '23:59')
    assert.match(text(app.root), /Elige una hora futura/)
    await event(find(app.root, 'form'), 'submit'); assert.equal(posts, 0)
    await event(find(app.root, 'button', 'En 1 minuto'), 'click')
    now += 180000; t.mock.timers.tick(1000); await flush()
    assert.equal(find(app.root, 'button', 'Confirmar reserva').props.disabled, true)
    assert.equal(find(app.root, 'a', 'Mis términos').props.to, '/app/terms')
    assert.doesNotMatch(text(app.root), /El servidor validará|hora local del dispositivo/)
  } finally { app.unmount(); await flush() }
})
test('modal bloquea horario cerrado y ventana incompleta', async () => {
  setup(); const w = week(); w.forEach(d => d.intervals = [])
  globalThis.fetch = async () => Response.json(settings(w))
  const app = mount(Dialog, { copies, resourceName: 'Equipo' })
  try {
    await flush(); await model(find(app.root, 'select'), copies[0].id)
    assert.match(text(app.root), /no hay atención/)
    assert.equal(find(app.root, 'button', 'Confirmar reserva').props.disabled, true)
  } finally { app.unmount(); await flush() }
})
test('modal GET 503 visible con reintento, sin fallback ni POST', async () => {
  setup(); let failed = true, posts = 0
  globalThis.fetch = async (_url, options) => { if (options.method === 'POST') posts++; return failed ? Response.json({ message: 'Migración pendiente' }, { status: 503 }) : Response.json(settings()) }
  const app = mount(Dialog, { copies, resourceName: 'Equipo' })
  try {
    await flush(); assert.match(text(app.root), /Configuración no disponible/)
    await model(find(app.root, 'select'), copies[0].id)
    await event(find(app.root, 'form'), 'submit'); assert.equal(posts, 0)
    failed = false; await event(find(app.root, 'button', 'Reintentar'), 'click')
    assert.match(text(app.root), /Horario sin configurar/)
    assert.equal(find(app.root, 'button', 'Confirmar reserva').props.disabled, false)
  } finally { app.unmount(); await flush() }
})
test('modal POST incierto no se repite; advertencia y estado accesibles', async () => {
  setup(); let posts = 0
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'POST') { posts++; throw new Error('offline') }
    return Response.json(settings())
  }
  const app = mount(Dialog, { copies, resourceName: 'Equipo' })
  try {
    await flush(); await model(find(app.root, 'select'), copies[0].id)
    await event(find(app.root, 'form'), 'submit'); await event(find(app.root, 'form'), 'submit')
    assert.equal(posts, 1)
    assert.match(text(app.root), /No repitas; consulta tus reservas/)
    assert.ok(findAll(app.root, n => n.props.role === 'status').length)
  } finally { app.unmount(); await flush() }
})
test('tooltip: foco, escape, tap, outside, aria y texto sin interpretar markdown', async () => {
  setup(); const app = mount(Hint, { message: '**Aviso** <script>texto</script>', label: 'Detalle' })
  try {
    const button = find(app.root, 'button'), tooltip = findAll(app.root, n => n.props.role === 'tooltip')[0]
    assert.equal(button.props.type, 'button')
    assert.equal(button.props['aria-describedby'], tooltip.props.id)
    await event(button, 'focus'); assert.equal(button.props['aria-expanded'], true)
    const root = find(app.root, 'span')
    await event(root, 'keydown', { key: 'Escape' }); assert.equal(button.props['aria-expanded'], false)
    await event(button, 'click'); assert.equal(button.props['aria-expanded'], true)
    document.dispatchEvent(new Event('pointerdown')); await flush(); assert.equal(button.props['aria-expanded'], false)
    assert.equal(findAll(app.root, n => n.tag === 'script').length, 0)
    assert.match(text(tooltip), /<script>texto<\/script>/)
  } finally { app.unmount(); await flush() }
})
test('configuración: ruta/menú solo ADMIN, destino seleccionado y carga denegada sin red', async () => {
  for (const role of ['USUARIO', 'OPERADOR', 'ADMINISTRADOR']) {
    const allowed = role === 'ADMINISTRADOR'
    assert.equal(policy.canAccess('/app/admin/settings', role), allowed)
    assert.equal(policy.navigationGroups(role).flatMap(g => g.links).some(l => l.to === '/app/admin/settings'), allowed)
  }
  assert.equal(policy.navigationIsCurrent('/app/admin/settings', '/app/admin/settings'), true)
  const router = await readFile(new URL('../src/router.ts', import.meta.url), 'utf8')
  assert.match(router, /path: 'admin\/settings'.*SystemSettingsPage/)
  setup('OPERADOR'); let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json(settings()) }
  await assert.rejects(api.saveReservationSettings({ pickupWaitMinutes: 30, weeklySchedule: null }), e => e.status === 403)
  const app = mount(Page)
  try { await flush(); assert.equal(calls, 0); assert.match(text(app.root), /exclusivo de administración/) }
  finally { app.unmount(); await flush() }
})
test('ADMIN carga real sin defaults de horario; valida y guarda semana completa/espera', async () => {
  setup('ADMINISTRADOR'); const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push([url, options])
    if (options.method === 'PATCH') return Response.json({ ...settings(JSON.parse(options.body).weeklySchedule), pickupWaitMinutes: JSON.parse(options.body).pickupWaitMinutes, version: 2 })
    return Response.json(settings())
  }
  const app = mount(Page)
  try {
    await flush(); assert.equal(input(app.root, 'number').value, 30)
    assert.match(text(app.root), /Horario sin configurar/)
    assert.equal(findAll(app.root, n => n.tag === 'input' && n.props.type === 'time').length, 0)
    await model(input(app.root, 'checkbox'), true)
    assert.equal(findAll(app.root, n => n.tag === 'fieldset').length, 7)
    await event(find(app.root, 'button', 'Añadir franja'), 'click')
    assert.equal(input(app.root, 'time').value, '')
    await event(find(app.root, 'form'), 'submit'); assert.equal(calls.length, 1)
    const times = findAll(app.root, n => n.tag === 'input' && n.props.type === 'time')
    await model(times[0], '08:00'); await model(times[1], '18:00')
    await model(input(app.root, 'number'), 241)
    await event(find(app.root, 'form'), 'submit'); assert.equal(calls.length, 1)
    await model(input(app.root, 'number'), 45)
    await event(find(app.root, 'form'), 'submit')
    assert.equal(calls.length, 2); assert.equal(calls[1][0], '/api/system/reservation-settings')
    const body = JSON.parse(calls[1][1].body)
    assert.equal(body.pickupWaitMinutes, 45); assert.equal(body.weeklySchedule.length, 7)
    assert.deepEqual(body.weeklySchedule[1].intervals, [])
    assert.match(text(app.root), /Configuración guardada/)
    assert.doesNotMatch(text(app.root), /Cambios sin guardar/)
  } finally { app.unmount(); await flush() }
})
test('ADMIN error 503 carga/retry y PATCH incierto requiere consulta antes de guardar', async () => {
  setup('ADMINISTRADOR'); let loadFail = true, writes = 0
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'PATCH') { writes++; return Response.json({ message: 'migración pendiente' }, { status: 503 }) }
    return loadFail ? Response.json({ message: 'migración pendiente' }, { status: 503 }) : Response.json(settings())
  }
  const app = mount(Page)
  try {
    await flush(); assert.match(text(app.root), /migración pendiente/)
    assert.equal(find(app.root, 'form'), undefined)
    loadFail = false; await event(find(app.root, 'button', 'Reintentar'), 'click')
    await model(input(app.root, 'number'), 50); await event(find(app.root, 'form'), 'submit')
    assert.doesNotMatch(text(app.root), /Configuración guardada/)
    assert.match(text(app.root), /Guardado sin confirmar/)
    await event(find(app.root, 'form'), 'submit'); assert.equal(writes, 1)
    await event(find(app.root, 'button', 'Consultar configuración'), 'click')
    assert.equal(input(app.root, 'number').value, 30)
    assert.doesNotMatch(text(app.root), /Guardado sin confirmar/)
  } finally { app.unmount(); await flush() }
})
