import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { load, loadComponent, session, testEnvironment } from './helpers/modules.mjs'
import { mount, flush, find, findAll, text, model, event } from './helpers/renderer.mjs'
import { compatibility, inventoryCopy } from './helpers/inventory-compatibility-fixtures.mjs'
import { activeLoan, returnPolicy } from './helpers/loan-closure-fixtures.mjs'

const auth = await load('modules/auth/api/auth-api')
const categories = await load('modules/inventory/api/categories-api')
const loans = await load('modules/loans/api/loans-api')
const { useCopyDetails } = await load('modules/inventory/useCopyDetails')
const CategoryEditor = await loadComponent('modules/inventory/components/CategoryEditorDialog')
const Operations = await loadComponent('modules/loans/pages/LoanOperationsPage')
const Reservations = await loadComponent('modules/loans/components/ReservationsPanel')
const category = { id: 'review-category', nombre: 'Equipos', descripcion: null, activo: true, tiempoMaximoPrestamoDias: 2, tiempoMaximoPrestamoHoras: 24 }
beforeEach(() => { testEnvironment(); auth.saveSession(session('ADMINISTRADOR')); loans.setPendingReturn('loan', false) })

test('descriptivo confirma solo nombre/descripcion enviados; edición completa sigue siendo estricta', async () => {
  const input = { ...category, activo: false, tiempoMaximoPrestamoDias: 1, tiempoMaximoPrestamoHoras: 48 }
  let writes = 0
  globalThis.fetch = async (_url, options) => {
    writes++; assert.deepEqual(JSON.parse(options.body), { nombre: category.nombre, descripcion: null })
    return Response.json(category)
  }
  assert.deepEqual(await categories.saveCategory(category.id, input, { descriptiveOnly: true }), category)
  assert.equal(categories.categoryMatches(category, input, { descriptiveOnly: true }), true)
  assert.equal(categories.categoryMatches(category, input), false)
  assert.equal(categories.categoryMatches({ ...category, nombre: 'Otro' }, input, { descriptiveOnly: true }), false)
  assert.equal(writes, 1)
  const fullId = category.id + '-full'
  globalThis.fetch = async (_url, options) => {
    writes++; assert.deepEqual(JSON.parse(options.body), input)
    return Response.json({ ...category, id: fullId })
  }
  await assert.rejects(categories.saveCategory(fullId, input), e => e.status === 0)
  assert.equal(writes, 2)
})

test('modo descriptivo no valida duración no enviada; modo completo sí', async () => {
  const input = { ...category, tiempoMaximoPrestamoHoras: 0, tiempoMaximoPrestamoDias: 0 }
  let writes = 0
  globalThis.fetch = async () => { writes++; return Response.json(category) }
  await categories.saveCategory(category.id, input, { descriptiveOnly: true })
  await assert.rejects(categories.saveCategory(category.id, input), e => e.status === 400)
  await assert.rejects(categories.saveCategory(null, category, { descriptiveOnly: true }), e => e.status === 400)
  await assert.rejects(categories.saveCategory(category.id, { ...category, nombre: '' }, { descriptiveOnly: true }), e => e.status === 400)
  assert.equal(writes, 1)
})

for (const uncertain of [false, true]) test(`editor descriptivo días=2/horas=24: ${uncertain ? 'concilia respuesta perdida' : 'confirma PATCH'}`, async () => {
  let writes = 0
  globalThis.fetch = async (url, options) => {
    if (options.method === 'PATCH') {
      writes++; assert.deepEqual(JSON.parse(options.body), { nombre: category.nombre, descripcion: null })
      if (uncertain) throw new TypeError('offline')
      return Response.json(category)
    }
    return Response.json(url.endsWith('/policies') ? { status: 'INCOMPLETE', eligibleForNewOperations: false, policies: [], rulesEditable: false } : category)
  }
  const app = mount(CategoryEditor, { category, compatibility: compatibility(false) })
  try {
    await flush(); await event(find(app.root, 'form'), 'submit'); await flush()
    if (uncertain) {
      assert.match(text(app.root), /Resultado incierto/)
      await event(find(app.root, 'button', 'Consultar estado guardado'), 'click'); await flush()
      assert.match(text(app.root), /los datos coinciden/)
      assert.equal(find(app.root, 'button', 'Consultar estado guardado'), undefined)
    } else assert.match(text(app.root), /Categoría confirmada/)
    assert.equal(writes, 1)
    assert.equal(category.tiempoMaximoPrestamoDias, 2)
  } finally { app.unmount() }
})

test('detalles revalidados ignoran respuesta vieja en vuelo y conservan identificador al fallar', async () => {
  const source = ref([{ copyId: 'c1' }])
  let resolveOld, details
  globalThis.fetch = () => new Promise(resolve => { resolveOld = resolve })
  const app = mount({ setup() { details = useCopyDetails(source, { revalidateOnChange: true }); return () => null } })
  try {
    await flush()
    globalThis.fetch = async () => Response.json({ ...inventoryCopy(), recurso: { id: 'r1', nombre: 'Actual' } })
    source.value = [{ copyId: 'c1' }]; await flush(); await flush()
    assert.equal(details.value.c1.compatibility.status, 'READY')
    resolveOld(Response.json({ ...inventoryCopy(false), recurso: { id: 'r1', nombre: 'Obsoleto' } }))
    await flush(); assert.equal(details.value.c1.recurso.nombre, 'Actual')
    globalThis.fetch = async () => { throw new TypeError('offline') }
    source.value = [{ copyId: 'c1' }]; await flush()
    assert.equal(details.value.c1, undefined); assert.equal(source.value[0].copyId, 'c1')
  } finally { app.unmount() }
})

for (const staff of [false, true]) test(`reservas ${staff}: actualizar recupera capacidad y fallo posterior no conserva READY`, async () => {
  const reservation = { id: 'review-reservation', copyId: 'c1', userId: session().user.id, requestedAt: '2099-01-01T00:00:00Z', pickupDeadline: '2099-01-01T01:00:00Z', configurationSnapshot: null, status: 'CONFIRMADA' }
  let ready = false, fail = false, writes = 0, reads = 0
  globalThis.fetch = async (url, options) => {
    if (options.method !== 'GET') { writes++; throw Error('No debe escribir') }
    if (url.includes('/reservations?')) return Response.json({ items: [reservation], total: 1, page: 1, limit: 20 })
    if (url.includes('/copies/')) {
      reads++; if (fail) throw new TypeError('offline')
      return Response.json({ ...inventoryCopy(ready, { estado: 'RESERVADO' }), recurso: { id: 'r1', nombre: 'Equipo' } })
    }
    return Response.json({ id: reservation.userId, name: 'Titular' })
  }
  const app = mount(Reservations, { staff })
  const refresh = async () => {
    if (staff) await event(find(app.root, 'button', 'Consultar / actualizar reservas'), 'click')
    else window.dispatchEvent(new Event('focus'))
    await flush(); await flush()
  }
  const action = () => find(app.root, 'button', staff ? 'Confirmar entrega' : 'Cancelar mi reserva')
  try {
    if (staff) await refresh(); else { await flush(); await flush() }
    assert.equal(action().props.disabled, true)
    ready = true; await refresh(); assert.equal(action().props.disabled, false)
    fail = true; await refresh(); assert.equal(action().props.disabled, true)
    assert.match(text(app.root), /Ejemplar c1/)
    fail = false; await refresh(); assert.equal(action().props.disabled, false)
    assert.ok(reads >= 4); assert.equal(writes, 0)
  } finally { app.unmount() }
})

test('operador recupera diálogo abierto al actualizar; resultado incierto conserva cuerpo/UUID sin autoenvío', async () => {
  const loan = activeLoan()
  let ready = false, writes = 0
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') { writes++; return Response.json({ code: 'SCHEMA_CAPABILITY_UNAVAILABLE', message: 'Temporal' }, { status: 503 }) }
    if (url.endsWith('/active') || url.endsWith('/overdue')) return Response.json([loan])
    if (url.endsWith('/return-policy')) return Response.json(returnPolicy(loan.id, []))
    if (url.endsWith('/evidence')) return Response.json([])
    if (url.includes('/copies/')) return Response.json({ ...inventoryCopy(ready, { id: loan.copyId, estado: 'PRESTADO' }), recurso: { id: 'r1', nombre: 'Equipo' } })
    if (url.endsWith('/loans/' + loan.id)) return Response.json(loan)
    return Response.json({ id: loan.userId, name: 'Titular' })
  }
  const app = mount(Operations)
  try {
    await flush(); await flush(); await event(find(app.root, 'button', 'Registrar devolución'), 'click'); await flush()
    await model(findAll(app.root, n => n.tag === 'input' && n.props.type === 'radio')[0], 'SANO')
    assert.equal(find(app.root, 'button', 'Confirmar devolución integral').props.disabled, true)
    ready = true; await event(find(app.root, 'button', 'Actualizar listas'), 'click'); await flush(); await flush()
    assert.equal(find(app.root, 'button', 'Confirmar devolución integral').props.disabled, false)
    await event(find(find(app.root, 'dialog'), 'form'), 'submit'); await flush()
    const original = loans.getPendingClosure(loan.id)
    assert.ok(original?.requestId); assert.equal(writes, 1)
    ready = false; await event(find(app.root, 'button', 'Actualizar listas'), 'click'); await flush(); await flush()
    ready = true; await event(find(app.root, 'button', 'Actualizar listas'), 'click'); await flush(); await flush()
    assert.deepEqual(loans.getPendingClosure(loan.id), original); assert.equal(writes, 1)
    assert.equal(find(app.root, 'button', 'Confirmar devolución integral').props.disabled, true)
  } finally { app.unmount(); loans.setPendingReturn(loan.id, false) }
})
