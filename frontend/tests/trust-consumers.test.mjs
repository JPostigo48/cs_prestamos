import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, text, event, model } from './helpers/renderer.mjs'
import { rule, ruleId, userId, sanction, appeal } from './helpers/trust-fixtures.mjs'
const auth = await load('modules/auth/api/auth-api')
const api = await load('modules/trust/api/trust-api')
const contracts = await load('modules/trust/api/trust-contracts')
const Details = await loadComponent('modules/trust/components/SanctionDetails')
const Mine = await loadComponent('modules/trust/components/MyAppeals')
const Actions = await loadComponent('modules/users/components/UserActionsDialog')
const Appeals = await loadComponent('modules/trust/pages/AppealsPage')
beforeEach(() => { testEnvironment(); auth.saveSession(session('ADMINISTRADOR')) })
const page = (items = [], changes = {}) => ({ items, total: items.length, page: 1, limit: 20, ...changes })
const user = { id: userId, name: 'Usuario real', userType: 'DOCENTE', institutionalId: null, trustPercentage: 80, hasCurrentAffiliation: true }

test('trust: GET apelaciones autentica y serializa todos los filtros y paginación', async () => {
  globalThis.fetch = async (url, options) => {
    const params = new URL(url, 'https://offline.invalid').searchParams
    assert.equal(new URL(url, 'https://offline.invalid').pathname, '/api/appeals')
    assert.equal(options.headers.Authorization, 'Bearer offline-test-token')
    assert.deepEqual(Object.fromEntries(params), { page: '2', limit: '100', status: 'PENDIENTE', userId, sanctionId: ruleId })
    return Response.json(page([appeal({ sanctionId: ruleId })], { page: 2, limit: 100, total: 101 }))
  }
  assert.equal((await api.listAppeals({ page: 2, limit: 100, status: 'PENDIENTE', userId, sanctionId: ruleId })).total, 101)
})
test('trust: filtros inválidos no llegan a red y lista vacía es válida', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json(page()) }
  for (const query of [{ page: 0 }, { limit: 101 }, { status: 'OTRO' }, { userId: 'no-uuid' }, { sanctionId: 'no-uuid' }]) await assert.rejects(api.listAppeals(query), e => e.status === 400)
  assert.equal(calls, 0)
  assert.deepEqual((await api.listAppeals()).items, [])
})
test('trust: lectura propia rechaza titulares ajenos y formas inválidas sin convertirlas en vacíos', async () => {
  auth.saveSession(session())
  for (const payload of [null, {}, page([appeal({ userId: 'otro' })]), page([appeal({ submittedAt: '2026-02-30T00:00:00Z' })]), page([], { page: 9 }), page([], { total: -1 })]) {
    globalThis.fetch = async () => Response.json(payload)
    await assert.rejects(api.listAppeals(), e => e.status === 0)
  }
  globalThis.fetch = async () => Response.json(page([appeal()]))
  assert.equal((await api.listAppeals()).items[0].userId, userId)
})
test('trust: detalle conserva la versión histórica INACTIVA y los campos reason y resolución reales', async () => {
  const detail = sanction({ rule: rule({ status: 'INACTIVA' }), appeals: [appeal({ status: 'RECHAZADA', resolution: 'Fundamento real', resolvedAt: '2026-10-29T01:00:00Z', resolvedByAccountId: 'actor' })], history: [{ action: 'CREADA', occurredAt: '2026-10-28T00:00:00Z', actorAccountId: null, reason: null }] })
  globalThis.fetch = async url => { assert.equal(url, '/api/sanctions/sanction-real'); return Response.json(detail) }
  assert.deepEqual(await api.getSanction('sanction-real'), detail)
  const app = mount(Details, { sanctionId: 'sanction-real' })
  try {
    await flush()
    assert.match(text(app.root), /Motivo registrado/)
    assert.doesNotMatch(text(app.root), /versión 2|sanction-real|actor/)
    assert.match(text(app.root), /Fundamento real/)
    assert.doesNotMatch(text(app.root), /CREADA/)
  } finally { app.unmount() }
})
test('trust: detalle rechaza ID, titular o versión histórica ajenos; no consulta reglas actuales', async () => {
  auth.saveSession(session())
  for (const payload of [sanction({ id: 'otro' }), sanction({ userId: 'otro' }), sanction({ ruleVersionId: 'otra-version' }), null]) {
    globalThis.fetch = async () => Response.json(payload)
    await assert.rejects(api.getSanction('sanction-real'), e => e.status === 0)
  }
  globalThis.fetch = async () => Response.json(sanction({ rule: null, ruleVersionId: null, violation: null, reason: null }))
  assert.equal((await api.getSanction('sanction-real')).rule, null)
})
const scaledCurrent = () => ({
  severity: 'GRAVE', rule: rule({ id: 'version-grave', number: 3, penaltyPercentage: 30, suspensionDays: 30 }),
  nominalPenaltyTotal: 30, effectivePenaltyTotal: 25, suspensionDays: 30,
  adjustments: ['LEVE', 'MODERADA', 'GRAVE'].map((severity, i) => ({
    id: 'adjustment-' + i, ruleVersionId: i === 2 ? 'version-grave' : 'version-' + i,
    severity, effect: 'DISCOUNT', nominalTarget: (i + 1) * 10, nominalIncrement: 10,
    effectiveDiscount: i === 0 ? 5 : 10, previousTrust: i === 0 ? 5 : 80 - (i - 1) * 10,
    resultingTrust: i === 0 ? 0 : 70 - (i - 1) * 10, suspensionDays: [7, 15, 30][i],
    effectiveAt: `2026-10-28T0${i}:00:00Z`, recordedAt: '2026-10-28T04:00:00Z',
  })),
})
test('H3: consumidor y detalle separan antecedente inicial de total efectivo/nominal y ajustes, incluso absuelta', async () => {
  const detail = sanction({ previousTrust: 5, resultingTrust: 0, current: scaledCurrent(), status: 'ABSUELTA' })
  globalThis.fetch = async () => Response.json(detail)
  assert.deepEqual(await api.getSanction('sanction-real'), detail)
  const app = mount(Details, { sanctionId: 'sanction-real' })
  try {
    await flush()
    assert.match(text(app.root), /Antecedente inicial.*5 % → 0 %/)
    assert.match(text(app.root), /Consecuencia actual acumulada · GRAVE/)
    assert.match(text(app.root), /Objetivo nominal: 30 puntos · Descuento efectivo total: 25 puntos/)
    assert.match(text(app.root), /Suspensión acumulada: 30 días/)
    assert.match(text(app.root), /Historial de ajustes \(3\)/)
    assert.match(text(app.root), /Sanción absuelta/)
  } finally { app.unmount() }
  assert.equal(contracts.validSanctionDetail(sanction({ current: null })), true)
  const zero = scaledCurrent()
  zero.rule = rule({ id: 'zero', suspensionType: 'INDEFINIDA', suspensionDays: null })
  zero.nominalPenaltyTotal = null; zero.effectivePenaltyTotal = 42; zero.suspensionDays = null
  zero.adjustments = [{ ...zero.adjustments[2], ruleVersionId: 'zero', effect: 'SET_ZERO', nominalTarget: null, nominalIncrement: null, previousTrust: 42, resultingTrust: 0, effectiveDiscount: 42, suspensionDays: null }]
  assert.equal(contracts.validSanctionDetail(sanction({ current: zero })), true)
  for (const change of [
    { effectivePenaltyTotal: 30 }, { nominalPenaltyTotal: 40 }, { severity: 'LEVE' },
    { rule: rule({ id: 'version-ajena' }) }, { adjustments: [] },
    { adjustments: [...scaledCurrent().adjustments, scaledCurrent().adjustments[0]] },
    { adjustments: scaledCurrent().adjustments.map(a => ({ ...a, effectiveDiscount: -1 })) },
  ]) {
    globalThis.fetch = async () => Response.json(sanction({ current: { ...scaledCurrent(), ...change } }))
    await assert.rejects(api.getSanction('sanction-real'), e => e.status === 0)
  }
})
test('sanción compacta: motivo de política histórica, impacto real y sin bloques técnicos ni vacíos', async () => {
  const detail = sanction({ reason: null, status: 'FINALIZADA', previousTrust: 100, resultingTrust: 98,
    rule: rule({ title: 'R-RES:LEVE', description: JSON.stringify({ format: 'epcc.official-policy/v1', kind: 'NO_SHOW' }), suspensionType: 'NINGUNA', suspensionDays: null }),
    history: [{ action: 'CONFIANZA_ACTUALIZADA', occurredAt: '2026-10-28T00:00:00Z', actorAccountId: 'internal-actor', reason: null }] })
  globalThis.fetch = async () => Response.json(detail)
  const app = mount(Details, { sanctionId: detail.id })
  try {
    await flush()
    assert.match(text(app.root), /Reserva no recogida/)
    assert.match(text(app.root), /100 % → 98 %/)
    assert.match(text(app.root), /Finalizada/)
    assert.doesNotMatch(text(app.root), /R-RES|versión|CONFIANZA_ACTUALIZADA|internal-actor|Suspensión|Sin apelaciones|no aportó|Consultar/)
    assert.ok(find(app.root, 'time').props.datetime)
  } finally { app.unmount() }
})
test('trust: reglas oficiales requieren contexto; suspensiones manuales legítimas se conservan', async () => {
  const official = kind => rule({ description: JSON.stringify({ format: 'epcc.official-policy/v1', kind, trustEffect: 'DISCOUNT' }) })
  const candidates = [rule(), ...['DAMAGE', 'LOSS', 'LATENESS', 'NO_SHOW', 'ACCESS', 'TRUST', 'REWARD'].map(official), rule({ suspensionType: 'NINGUNA', suspensionDays: null }), rule({ status: 'INACTIVA' }), rule({ suspensionDays: 0 })]
  globalThis.fetch = async url => { assert.equal(url, '/api/rules/active'); return Response.json(candidates) }
  assert.deepEqual(await api.listSuspensionRules(), [rule()])
  assert.equal(contracts.manualSuspensionRule(official('DAMAGE')), false)
  assert.equal(contracts.manualSuspensionRule(rule({ penaltyPercentage: 0, suspensionType: 'INDEFINIDA', suspensionDays: null, description: JSON.stringify({ format: 'epcc.official-policy/v1', kind: 'LOSS', trustEffect: 'SET_ZERO' }) })), false)
})
test('trust: lectura de proyección escalada conserva regla inicial y acepta periodo efectivo ampliado', async () => {
  const detail = sanction({ startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-02-01T00:00:00Z', resultingTrust: 0 })
  assert.equal(contracts.validSanctionDetail(detail), true)
  globalThis.fetch = async () => Response.json(detail)
  assert.deepEqual(await api.getSanction(detail.id), detail)
})
test('trust: suspensión envía regla, motivo y clave de reintento; calendario y efecto salen del servidor', async () => {
  const startsAt = new Date(Date.now() - 1000).toISOString()
  const detail = sanction({ startsAt, endsAt: new Date(Date.parse(startsAt) + 7 * 86400000).toISOString() })
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/users/' + userId + '/suspensions')
    assert.equal(options.method, 'POST')
    const body = JSON.parse(options.body)
    assert.match(body.requestId, /^[0-9a-f-]{36}$/i)
    assert.deepEqual({ ...body, requestId: undefined }, { ruleId, reason: 'Motivo', requestId: undefined })
    return Response.json(detail)
  }
  assert.deepEqual(await api.suspendUser(userId, { ruleId, reason: ' Motivo ' }), detail)
})
test('trust: suspensión incierta no confirma regla/duración contradictoria ni duplica envío', async () => {
  let calls = 0
  const target = 'trust-incierto'
  globalThis.fetch = async () => { calls++; return Response.json(sanction({ userId: target, endsAt: null })) }
  await assert.rejects(api.suspendUser(target, { ruleId, reason: 'Motivo conservado' }), e => e.status === 0)
  await assert.rejects(api.suspendUser(target, { ruleId, reason: 'Motivo conservado' }), e => e.status === 0)
  assert.equal(calls, 1)
})
test('trust: solo ADMINISTRADOR suspende/levanta; fundamento y regla son obligatorios', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('No debe enviar') }
  for (const role of ['USUARIO', 'OPERADOR']) {
    auth.saveSession(session(role))
    await assert.rejects(api.suspendUser(userId, { ruleId, reason: 'Motivo' }), e => e.status === 403)
    await assert.rejects(api.liftSanction('s', 'Motivo'), e => e.status === 403)
  }
  auth.saveSession(session('ADMINISTRADOR'))
  for (const body of [{ ruleId, reason: ' ' }, { ruleId: 'incorrecta', reason: 'Motivo' }, { ruleId, reason: 'x'.repeat(2001) }, { ruleId, reason: 'Motivo', startsAt: '2026-02-30T00:00:00Z' }]) await assert.rejects(api.suspendUser(userId, body), e => e.status === 400)
  for (const resolution of [' ', 'x'.repeat(2001)]) await assert.rejects(api.liftSanction('s', resolution), e => e.status === 400)
  assert.equal(calls, 0)
})
test('trust: levantamiento exige misma sanción FINALIZADA, nunca ABSUELTA, sin restauración local', async () => {
  for (const [index, change] of [{ status: 'ACTIVA' }, { status: 'ABSUELTA' }, { id: 'otra' }].entries()) {
    const id = 'trust-lift-invalid-' + index
    globalThis.fetch = async () => Response.json(sanction({ id, ...change }))
    await assert.rejects(api.liftSanction(id, 'Fundamento'), e => e.status === 0)
  }
  const detail = sanction({ id: 'trust-lift-ok', status: 'FINALIZADA' })
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/sanctions/trust-lift-ok/lift')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { resolution: 'Fundamento' })
    return Response.json(detail)
  }
  assert.equal((await api.liftSanction(detail.id, ' Fundamento ')).resultingTrust, 70)
})
test('trust: consulta de mis apelaciones pagina, muestra resolución y vacío', async () => {
  auth.saveSession(session())
  const calls = []
  globalThis.fetch = async url => {
    calls.push(String(url))
    const n = Number(new URL(url, 'https://offline.invalid').searchParams.get('page'))
    return Response.json(n === 1 ? page([appeal({ resolution: 'Decisión real', status: 'RECHAZADA' })], { total: 21 }) : page([], { page: n, total: 21 }))
  }
  const app = mount(Mine, { userId })
  try {
    await flush(); assert.equal(calls.length, 1)
    assert.match(text(app.root), /Decisión real/)
    await event(find(app.root, 'button', 'Siguiente'), 'click')
    assert.ok(calls[1].includes('page=2'))
    assert.match(text(app.root), /No hay apelaciones/)
  } finally { app.unmount() }
})
test('trust: errores 403/500 son visibles, conservan sesión y permiten reconsultar', async () => {
  globalThis.fetch = async () => Response.json({ message: 'Error de prueba' }, { status: 403 })
  const app = mount(Details, { sanctionId: 'trust-error' })
  try {
    for (const status of [403, 500]) {
      globalThis.fetch = async () => Response.json({ message: 'Error de prueba' }, { status })
      if (status === 403) await flush()
      else await event(find(app.root, 'button', 'Volver a intentar'), 'click')
      assert.ok(find(app.root, 'p') || find(app.root, 'button', 'Reintentar'))
      assert.match(text(app.root), status === 403 ? /Acceso denegado/ : /No pudimos comunicarnos/)
      assert.ok(auth.getSession())
    }
    globalThis.fetch = async () => Response.json(sanction({ id: 'trust-error' }))
    await event(find(app.root, 'button', 'Volver a intentar'), 'click')
    assert.match(text(app.root), /Motivo registrado/)
  } finally { app.unmount() }
})
test('trust: formulario administrativo selecciona regla real y omite fechas y porcentajes editables', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    if (url.endsWith('/rules/active')) return Response.json([rule()])
    if (url.endsWith('/suspensions')) {
      const startsAt = new Date(Date.now() - 1000).toISOString()
      return Response.json(sanction({ startsAt, endsAt: new Date(Date.parse(startsAt) + 7 * 86400000).toISOString() }))
    }
    return Response.json([])
  }
  const app = mount(Actions, { user })
  try {
    await flush()
    await event(find(app.root, 'button', 'Suspender'), 'click')
    assert.equal(findAll(app.root, n => n.tag === 'input' && n.props.type === 'datetime-local').length, 0)
    await event(find(app.root, 'button', 'Consultar reglas'), 'click')
    const form = findAll(app.root, n => n.tag === 'form').find(n => text(n).includes('Suspender usuario'))
    await model(find(form, 'select'), ruleId)
    await model(find(form, 'textarea'), 'Motivo acreditado')
    assert.match(text(form), /Consecuencia versionada real/)
    await event(form, 'submit')
    const write = calls.find(c => c.options.method === 'POST')
    const body = JSON.parse(write.options.body)
    assert.match(body.requestId, /^[0-9a-f-]{36}$/i)
    assert.deepEqual({ ...body, requestId: undefined }, { reason: 'Motivo acreditado', ruleId, requestId: undefined })
    assert.match(text(app.root), /Suspensión confirmada/)
  } finally { app.unmount() }
})
test('trust: OPERADOR consulta apelaciones pero no obtiene controles de resolución o suspensión', async () => {
  auth.saveSession(session('OPERADOR'))
  globalThis.fetch = async url => Response.json(url.includes('/appeals?') ? page([appeal()]) : url.endsWith('/sanctions') ? [] : user)
  const app = mount(Appeals)
  try {
    await event(find(app.root, 'form'), 'submit')
    assert.match(text(app.root), /Revisión solicitada/)
    assert.equal(find(app.root, 'button', 'Aprobar apelación'), undefined)
    assert.equal(find(app.root, 'button', 'Rechazar'), undefined)
  } finally { app.unmount() }
  const actions = mount(Actions, { user })
  try { await flush(); assert.equal(find(actions.root, 'button', 'Confirmar solicitud de suspensión'), undefined) } finally { actions.unmount() }
})
