import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ref, defineComponent, h } from 'vue'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model, text } from './helpers/renderer.mjs'
import { activeLoan, returnPolicy, returnBody, closedLoan, partId, requestId } from './helpers/loan-closure-fixtures.mjs'
const auth = await load('modules/auth/api/auth-api')
const api = await load('modules/loans/api/loans-api')
const policy = await load('modules/loans/return-policy')
const contracts = await load('modules/loans/api/loan-contracts')
const closureContracts = await load('modules/loans/api/closure-contracts')
const Dialog = await loadComponent('modules/loans/components/ReturnLoanDialog')
const Incident = await loadComponent('modules/loans/components/CloseIncidentDialog')
const Checklist = await loadComponent('modules/loans/components/ReturnChecklist')
const Result = await loadComponent('modules/loans/components/ClosureResult')
const history = await load('modules/loans/personal-history')
beforeEach(() => { testEnvironment(); auth.saveSession(session('OPERADOR')); api.setPendingReturn('loan', false) })
const posts = calls => calls.filter(c => c.options.method === 'POST')
function fixtureFetch(calls, response) {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/return-policy')) return Response.json(returnPolicy())
    if (url.endsWith('/evidence')) return Response.json([])
    if (options.method === 'POST') return response ? response(url, options) : Response.json(closedLoan(activeLoan(), JSON.parse(options.body)))
    return Response.json(activeLoan())
  }
}
async function selectHealthy(root, received = true) {
  await event(find(root, 'select'), 'change', { target: { value: String(received) } })
  await model(findAll(root, n => n.tag === 'input' && n.props.type === 'radio')[0], 'SANO')
}
test('F09 controlado: ninguna selección implícita ni red ni guardado independiente; cambios pertenecen al padre', async () => {
  const value = ref({ [partId]: null })
  const Harness = defineComponent({ setup: () => () => h(Checklist, { parts: returnPolicy().accessories, modelValue: value.value, disabled: false, 'onUpdate:modelValue': v => { value.value = v } }) })
  const app = mount(Harness)
  try {
    assert.equal(find(app.root, 'select').props.value, '')
    assert.equal(find(app.root, 'button'), undefined)
    await event(find(app.root, 'select'), 'change', { target: { value: 'false' } })
    assert.equal(value.value[partId], false)
    assert.equal(find(app.root, 'select').props.value, 'false')
  } finally { app.unmount() }
})
test('F09: partes y condición explícitas obligatorias; UNA llamada integral sin fecha cliente ni sanción/copy independiente', async () => {
  const calls = []; fixtureFetch(calls)
  const app = mount(Dialog, { loan: activeLoan(), copyLabel: 'Histórico' })
  try {
    await flush()
    const submit = () => find(app.root, 'button', 'Confirmar devolución integral')
    assert.equal(submit().props.disabled, true)
    await event(find(app.root, 'form'), 'submit'); assert.equal(posts(calls).length, 0)
    await event(find(app.root, 'select'), 'change', { target: { value: 'true' } })
    assert.equal(submit().props.disabled, true)
    await selectHealthy(app.root)
    assert.equal(submit().props.disabled, false)
    await event(find(app.root, 'form'), 'submit')
    const writes = posts(calls)
    assert.equal(writes.length, 1); assert.equal(writes[0].url, '/api/loans/loan/return')
    const body = JSON.parse(writes[0].options.body)
    assert.match(body.requestId, /^[\da-f-]{36}$/i)
    assert.deepEqual(body.inspection, returnBody().inspection)
    assert.doesNotMatch(JSON.stringify(body), /returnedAt|checkedAt|effectiveAt|actor|penalty|categoryId/)
    assert.ok(calls.every(c => /\/loans\/loan\/(return-policy|evidence|return)$/.test(c.url)))
    assert.match(text(app.root), /Devolución real confirmada/)
    assert.match(text(app.root), /0.5 puntos efectivos/)
  } finally { app.unmount() }
})
test('F09: daño/faltantes exige descripción y gravedades; una falta de mayor gravedad y política histórica visible', async () => {
  const calls = []; fixtureFetch(calls)
  const app = mount(Dialog, { loan: activeLoan(), copyLabel: 'Histórico' })
  try {
    await flush()
    await event(find(app.root, 'select'), 'change', { target: { value: 'false' } })
    await model(findAll(app.root, n => n.tag === 'input' && n.props.type === 'radio')[2], 'DANADO')
    let selects = findAll(app.root, n => n.tag === 'select')
    await model(selects[1], 'LEVE'); await model(selects[2], 'GRAVE')
    assert.equal(find(app.root, 'button', 'Confirmar devolución integral').props.disabled, true)
    assert.match(text(app.root), /Criterio histórico GRAVE/)
    assert.match(text(app.root), /Ya aplicada: LEVE · 5 puntos/)
    assert.match(text(app.root), /Proyectada al consultar: MODERADA · 10/)
    await model(find(app.root, 'textarea'), 'Cable faltante y daño físico')
    await event(find(app.root, 'form'), 'submit')
    assert.equal(posts(calls).length, 1)
    const body = JSON.parse(posts(calls)[0].options.body)
    assert.equal(body.inspection.damageSeverity, 'GRAVE')
    assert.equal(body.inspection.description, 'Cable faltante y daño físico')
    assert.equal('missingSeverity' in body.inspection, false)
  } finally { app.unmount() }
})
for (const condition of ['SANO', 'DESGASTE_NORMAL']) test(`${condition}: comentario no es daño y no envía gravedad ni descripción sancionadora`, () => {
  const body = policy.returnInput(requestId, returnPolicy(), { [partId]: true }, condition, 'GRAVE', 'GRAVE', 'Comentario antiguo', [], 'Observación sana')
  assert.equal(body.inspection.damageSeverity, undefined); assert.equal(body.inspection.description, undefined)
  assert.equal(body.observation, 'Observación sana')
})
for (const damage of ['LEVE', 'MODERADA', 'GRAVE']) for (const missing of ['LEVE', 'MODERADA', 'GRAVE']) test(`normativa daño ${damage} + faltantes ${missing}: un solo daño con máxima gravedad`, () => {
  const levels = ['LEVE', 'MODERADA', 'GRAVE']
  const body = policy.returnInput(requestId, returnPolicy(), { [partId]: false }, 'DANADO', damage, missing, 'Daño y componente faltante', [])
  assert.equal(body.inspection.damageSeverity, levels[Math.max(levels.indexOf(damage), levels.indexOf(missing))])
  assert.equal(Object.keys(body.inspection).filter(k => /severity/i.test(k)).length, 1)
  assert.equal('violations' in body, false)
})
test('faltantes sin daño físico: exige gravedad/descripcion y conserva condición sana, sin inventar segundo hecho', () => {
  const input = (severity, description) => policy.returnInput(requestId, returnPolicy(), { [partId]: false }, 'SANO', '', severity, description, [])
  assert.throws(() => input('', 'Falta cable'))
  assert.throws(() => input('MODERADA', '  '))
  const body = input('MODERADA', 'Falta cable')
  assert.equal(body.inspection.condition, 'SANO'); assert.equal(body.inspection.damageSeverity, 'MODERADA')
})
for (const values of [{}, { [partId]: null }, { [partId]: true, extra: true }]) test(`snapshot completo: rechaza partes incompletas/ajenas ${JSON.stringify(values)}`, () => {
  assert.throws(() => policy.returnInput(requestId, returnPolicy(), values, 'SANO', '', '', '', []))
})
test('snapshot vacío confirmado admite []; snapshot ausente no equivale a vacío', () => {
  assert.deepEqual(policy.returnInput(requestId, returnPolicy('loan', []), {}, 'SANO', '', '', '', []).inspection.parts, [])
  assert.throws(() => policy.returnInput(requestId, { ...returnPolicy(), accessories: undefined }, {}, 'SANO', '', '', '', []))
  assert.equal(closureContracts.validReturnPolicy({ ...returnPolicy(), accessories: undefined }, 'loan'), false)
})
for (const status of ['PLANIFICADO', 'FINALIZADO', 'CERRADO_POR_INCIDENCIA']) test(`${status}: no ofrece una nueva devolución`, async () => {
  const calls = []; fixtureFetch(calls)
  const app = mount(Dialog, { loan: { ...activeLoan(), status }, copyLabel: 'No activo' })
  try { await flush(); await selectHealthy(app.root); assert.equal(find(app.root, 'button', 'Confirmar devolución integral').props.disabled, true); await event(find(app.root, 'form'), 'submit'); assert.equal(posts(calls).length, 0) }
  finally { app.unmount() }
})
test('política fallida: no devolución básica, no snapshot supuesto; lectura se puede reintentar', async () => {
  let fail = true, writes = 0
  globalThis.fetch = async (url, o) => { if (o.method === 'POST') writes++; return url.endsWith('/evidence') ? Response.json([]) : fail ? Response.json({}, { status: 503 }) : Response.json(returnPolicy()) }
  const app = mount(Dialog, { loan: activeLoan(), copyLabel: 'Histórico' })
  try {
    await flush(); assert.match(text(app.root), /No se permite cerrar sin política histórica/)
    assert.equal(find(app.root, 'form'), undefined); assert.doesNotMatch(text(app.root), /Continuar con devolución básica/)
    fail = false; await event(find(app.root, 'button', 'Reintentar lectura'), 'click')
    assert.ok(find(app.root, 'form')); assert.equal(writes, 0)
  } finally { app.unmount() }
})
test('resultado incierto: conserva UUID/cuerpo, prohíbe alteración, GET activo no demuestra fallo; reintento idéntico recupera cierre', async () => {
  const calls = [], body = returnBody(); let fail = true
  fixtureFetch(calls, (_url, options) => fail ? Promise.reject(new Error('timeout')) : Response.json(closedLoan(activeLoan(), JSON.parse(options.body))))
  await assert.rejects(api.returnLoan('loan', body))
  assert.deepEqual(api.getPendingClosure('loan'), body)
  const original = api.getPendingClosure('loan'); original.inspection.condition = 'DANADO'
  assert.equal(api.getPendingClosure('loan').inspection.condition, 'SANO')
  await assert.rejects(api.returnLoan('loan', original), e => e.status === 409)
  assert.equal(posts(calls).length, 1)
  assert.equal(await api.reconcileClosure('loan'), null)
  assert.equal(api.hasPendingReturn('loan'), true)
  fail = false; const result = await api.returnLoan('loan', api.getPendingClosure('loan'))
  assert.equal(result.closure.requestId, body.requestId)
  assert.equal(posts(calls).length, 2); assert.equal(posts(calls)[0].options.body, posts(calls)[1].options.body)
  assert.equal(api.hasPendingReturn('loan'), false)
})
test('GET finalizado sin cierre o cierre de otra operación/actor no constituye éxito', async () => {
  const body = returnBody()
  globalThis.fetch = async () => Response.json({}, { status: 503 })
  await assert.rejects(api.returnLoan('loan', body))
  const original = closedLoan(activeLoan(), body)
  for (const result of [{ ...original, closure: null }, { ...original, closure: { ...original.closure, requestId: 'other' } }, { ...original, closure: { ...original.closure, actorUserId: 'other' } }]) {
    globalThis.fetch = async () => Response.json(result)
    assert.equal(await api.reconcileClosure('loan'), null)
    assert.equal(api.hasPendingReturn('loan'), true)
  }
  globalThis.fetch = async () => Response.json(original)
  assert.equal((await api.reconcileClosure('loan')).closure.id, 'closure')
})
test('modal incierto: reabrir conserva cuerpo; solo habilita retry exacto tras consulta, no cambios', async () => {
  const calls = []; fixtureFetch(calls, () => Promise.reject(new Error('timeout')))
  const first = mount(Dialog, { loan: activeLoan(), copyLabel: 'Histórico' })
  await flush(); await selectHealthy(first.root); await event(find(first.root, 'form'), 'submit')
  assert.match(text(first.root), /Resultado incierto/); first.unmount()
  const second = mount(Dialog, { loan: activeLoan(), copyLabel: 'Histórico' })
  try {
    await flush(); assert.equal(find(second.root, 'form'), undefined)
    assert.equal(find(second.root, 'button', 'Reintentar mismo cuerpo'), undefined)
    await event(find(second.root, 'button', 'Consultar cierre'), 'click')
    assert.match(text(second.root), /Una lectura activa no demuestra/)
    assert.ok(find(second.root, 'button', 'Reintentar mismo cuerpo'))
    await event(find(second.root, 'button', 'Reintentar mismo cuerpo'), 'click')
    assert.equal(posts(calls).length, 2); assert.equal(posts(calls)[0].options.body, posts(calls)[1].options.body)
  } finally { second.unmount() }
})
for (const status of [400, 409, 503]) test(`error ${status}: no éxito; conserva envío incierto/conflicto y permite corregir rechazo definitivo`, async () => {
  const body = returnBody(); globalThis.fetch = async () => Response.json({ message: 'Rechazado' }, { status })
  await assert.rejects(api.returnLoan('loan', body), e => e.status === status)
  assert.equal(api.hasPendingReturn('loan'), status !== 400)
})
for (const kind of ['PERDIDA', 'ROBO']) test(`${kind}: confirmación/descr obligatorias, UNA llamada contextual; no devolución/inspección/fecha/recompensa`, async () => {
  const calls = []; fixtureFetch(calls)
  const app = mount(Incident, { loan: activeLoan(), copyLabel: 'Incidente' })
  try {
    await flush(); assert.equal(find(app.root, 'button', 'Confirmar cierre por incidencia').props.disabled, true)
    await model(find(app.root, 'textarea'), 'Hecho acreditado')
    await model(find(app.root, 'input'), true)
    assert.equal(find(app.root, 'option', 'Selecciona el tipo de incidente').props.value, '')
    assert.equal(find(app.root, 'button', 'Confirmar cierre por incidencia').props.disabled, true)
    await event(find(app.root, 'form'), 'submit'); assert.equal(posts(calls).length, 0)
    await model(find(app.root, 'select'), kind)
    await model(find(app.root, 'input'), false)
    await event(find(app.root, 'form'), 'submit'); assert.equal(posts(calls).length, 0)
    await model(find(app.root, 'input'), true)
    await event(find(app.root, 'form'), 'submit')
    const writes = posts(calls); assert.equal(writes.length, 1); assert.equal(writes[0].url, '/api/loans/loan/close-incident')
    const body = JSON.parse(writes[0].options.body)
    assert.deepEqual(Object.keys(body).sort(), ['confirmed', 'description', 'evidenceIds', 'kind', 'requestId'])
    assert.equal(body.kind, kind); assert.equal(body.confirmed, true)
    assert.match(text(app.root), kind === 'ROBO' ? /Cierre por robo/ : /Cierre por pérdida/)
    assert.match(text(app.root), /Sin recompensa/)
    const result = closedLoan(activeLoan(), body)
    assert.equal(contracts.validLoan(result), true)
    assert.equal(history.historyState(result), 'CERRADO_POR_INCIDENCIA')
    assert.match(history.combineHistory([result], [])[0].dateLabel, /incidencia/)
    assert.equal(contracts.validLoan({ ...result, return: { returnedAt: result.closure.effectiveAt } }), false)
  } finally { app.unmount() }
})
test('resultado físico real retenido e inhabilitado, consecuencia persistida y recompensa efectiva sin promesa de disponibilidad', () => {
  const result = closedLoan(activeLoan(), returnBody())
  result.copy = { ...result.copy, estado: 'NO_DISPONIBLE', condicionFisica: 'DANADO_E_INCOMPLETO', habilitado: false }
  result.consequences = [{ violationId: 'v', sanctionId: 's', kind: 'DAMAGE', severity: 'GRAVE', effectivePenaltyTotal: 13, suspensionType: 'INDEFINIDA', suspensionDays: null }]
  const app = mount(Result, { loan: result })
  try { assert.match(text(app.root), /DANADO_E_INCOMPLETO/); assert.match(text(app.root), /Retenido/); assert.match(text(app.root), /13 puntos/); assert.match(text(app.root), /0.5 puntos efectivos/); assert.doesNotMatch(text(app.root), /volverá a estar disponible/) }
  finally { app.unmount() }
})

test('evidencias disponibles: solo devolución/daño del préstamo; selección explícita se incluye en el único cierre', async () => {
  const calls = [], evidenceId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  fixtureFetch(calls)
  const transport = globalThis.fetch
  globalThis.fetch = async (url, options) => url.endsWith('/evidence') ? Response.json([
    { id: evidenceId, loanId: 'loan', type: 'DANO', originalName: 'Daño acreditado', description: 'Mismo préstamo' },
    { id: 'delivery', loanId: 'loan', type: 'ENTREGA', originalName: 'Entrega', description: null },
  ]) : transport(url, options)
  const app = mount(Dialog, { loan: activeLoan(), copyLabel: 'Evidencias' })
  try {
    await flush(); await selectHealthy(app.root)
    const boxes = findAll(app.root, n => n.tag === 'input' && n.props.type === 'checkbox')
    assert.equal(boxes.length, 1); assert.equal(boxes[0].checked, false)
    await model(boxes[0], [evidenceId]); await event(find(app.root, 'form'), 'submit')
    assert.deepEqual(JSON.parse(posts(calls)[0].options.body).inspection.evidenceIds, [evidenceId])
    assert.equal(posts(calls).length, 1)
  } finally { app.unmount() }
})
test('evidencia ajena provoca lectura fallida, nunca habilita devolución silenciosamente sin evidencias', async () => {
  globalThis.fetch = async url => Response.json(url.endsWith('/return-policy') ? returnPolicy() : [{ id: 'other', loanId: 'foreign', type: 'DANO', originalName: 'Ajena' }])
  const app = mount(Dialog, { loan: activeLoan(), copyLabel: 'Evidencias' })
  try { await flush(); assert.equal(find(app.root, 'form'), undefined); assert.match(text(app.root), /No se permite cerrar sin política histórica/) }
  finally { app.unmount() }
})
test('restaura UUID y cuerpo desde almacenamiento de sesión tras recarga; actor distinto no recupera esta operación', () => {
  const id = 'restored', body = returnBody()
  const owner = session().user.id
  sessionStorage.setItem('cs-return-pending:' + owner + ':' + id, '1')
  sessionStorage.setItem('cs-return-pending:' + owner + ':' + id + ':body', JSON.stringify(body))
  assert.equal(api.hasPendingReturn(id), true)
  assert.deepEqual(api.getPendingClosure(id), body)
  const other = session('OPERADOR'); other.user.id = 'other-actor'; auth.saveSession(other)
  assert.equal(api.hasPendingReturn(id), false); assert.equal(api.getPendingClosure(id), null)
})
