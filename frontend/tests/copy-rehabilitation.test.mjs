import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, model, event, text } from './helpers/renderer.mjs'
const auth = await load('modules/auth/api/auth-api')
const inventory = await load('modules/inventory/api/inventory-api')
const contracts = await load('modules/inventory/api/copy-contracts')
const Dialog = await loadComponent('modules/inventory/components/RehabilitateCopyDialog')
const copy = { id: 'copy-rehab', recursoId: 'resource', codigoInventario: 'REHAB', estado: 'NO_DISPONIBLE', condicionFisica: 'DANADO', habilitado: true }
const verification = { fitForLoan: true, componentsComplete: true, reason: 'Reparación comprobada', evidenceIds: [] }
beforeEach(() => { testEnvironment(); auth.saveSession(session('OPERADOR')) })
for (const invalid of [undefined, {}, { ...verification, fitForLoan: false }, { ...verification, componentsComplete: false }, { ...verification, reason: '  ' }, { ...verification, reason: 'x'.repeat(1001) }, { ...verification, evidenceIds: undefined }, { ...verification, evidenceIds: ['invalid'] }, { ...verification, evidenceIds: ['AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] }]) test(`verificación inválida ${JSON.stringify(invalid)}`, async () => {
  let patches = 0
  globalThis.fetch = async (_url, options) => { if (options.method === 'PATCH') patches++; return Response.json(copy) }
  assert.equal(contracts.validCopyVerification(invalid), false)
  await assert.rejects(inventory.changeCopyState(copy, 'DISPONIBLE', invalid), e => e.status === 400)
  assert.equal(patches, 0)
})
test('rehabilitación modal sin selecciones implícitas; exige aptitud/componentes/motivo y envía verification, no confianza ni sanciones', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.includes('/history?')) return Response.json({ items: [], total: 0, page: 1, limit: 100 })
    return Response.json(options.method === 'PATCH' ? { ...copy, estado: 'DISPONIBLE', condicionFisica: 'APTO' } : copy)
  }
  const app = mount(Dialog, { copy })
  try {
    await flush()
    const submit = () => find(app.root, 'button', 'Confirmar rehabilitación')
    assert.equal(submit().props.disabled, true)
    const boxes = findAll(app.root, n => n.tag === 'input')
    assert.ok(boxes.every(n => !n.checked))
    await model(boxes[0], true); await model(find(app.root, 'textarea'), verification.reason)
    assert.equal(submit().props.disabled, true)
    await model(boxes[1], true); assert.equal(submit().props.disabled, false)
    await event(find(app.root, 'form'), 'submit')
    const writes = calls.filter(c => c.options.method === 'PATCH')
    assert.equal(writes.length, 1)
    assert.deepEqual(JSON.parse(writes[0].options.body), { estado: 'DISPONIBLE', verification })
    assert.ok(calls.every(c => !/sanction|trust|suspension/.test(c.url)))
    assert.match(text(app.root), /No levanta sanciones ni restituye confianza/)
  } finally { app.unmount() }
})
for (const state of ['PRESTADO', 'RESERVADO']) test(`revalidación ${state}: no modifica operación activa`, async () => {
  let patches = 0
  globalThis.fetch = async (_url, options) => { if (options.method === 'PATCH') patches++; return Response.json({ ...copy, estado: state }) }
  await assert.rejects(inventory.changeCopyState(copy, 'DISPONIBLE', verification), e => e.status === 409)
  assert.equal(patches, 0)
})
test('condición física y habilitación separadas; legado null válido como desconocido, nunca aptitud inferida', async () => {
  assert.equal(contracts.validCopy({ ...copy, condicionFisica: null }), true)
  assert.equal(contracts.validCopy({ ...copy, condicionFisica: undefined }), false)
  globalThis.fetch = async () => Response.json({ ...copy, habilitado: false })
  await assert.rejects(inventory.changeCopyState(copy, 'DISPONIBLE', verification), e => e.status === 400)
})
test('evidencias ajenas o lectura fallida impiden rehabilitación; [] explícito sí es válido', async () => {
  assert.equal(contracts.validCopyVerification(verification), true)
  let patches = 0
  globalThis.fetch = async (url, options) => {
    if (options.method === 'PATCH') patches++
    return Response.json(url.includes('/history?') ? { items: [], total: 0, page: 1, limit: 100 } : copy)
  }
  await assert.rejects(inventory.changeCopyState(copy, 'DISPONIBLE', { ...verification, evidenceIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] }), e => e.status === 400)
  assert.equal(patches, 0)
  globalThis.fetch = async () => Response.json({}, { status: 503 })
  const app = mount(Dialog, { copy })
  try { await flush(); assert.equal(find(app.root, 'button', 'Confirmar rehabilitación').props.disabled, true); assert.ok(find(app.root, 'button', 'Reintentar evidencias')) } finally { app.unmount() }
})
test('USUARIO no puede rehabilitar aun con verificación válida', async () => {
  auth.saveSession(session('USUARIO')); let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json(copy) }
  await assert.rejects(inventory.changeCopyState(copy, 'DISPONIBLE', verification), e => e.status === 403)
  assert.equal(calls, 0)
})
