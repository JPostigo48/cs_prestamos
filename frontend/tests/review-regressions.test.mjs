import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse } from '@vue/compiler-sfc'
import { load, testEnvironment, session } from './helpers/modules.mjs'
import { sanction, appeal } from './helpers/trust-fixtures.mjs'

const auth = await load('modules/auth/api/auth-api')
const loans = await load('modules/loans/api/loans-api')
const inventory = await load('modules/inventory/api/inventory-api')
const access = await load('modules/auth/api/access-flows-api')
const trust = await load('modules/trust/api/trust-api')
beforeEach(() => { testEnvironment(); auth.saveSession(session('ADMINISTRADOR')) })

test('reconciliación de devolución: ACTIVO, 404 e ID ajeno no desbloquean el envío', async () => {
  const id = 'loan-review'
  loans.setPendingReturn(id, true)
  globalThis.fetch = async url => {
    assert.equal(url, '/api/loans/' + id)
    return Response.json({ id, status: 'ACTIVO', return: null })
  }
  assert.equal(await loans.reconcileReturn(id), false)
  assert.equal(loans.hasPendingReturn(id), true)
  globalThis.fetch = async () => Response.json({}, { status: 404 })
  await assert.rejects(loans.reconcileReturn(id), e => e.status === 404)
  assert.equal(loans.hasPendingReturn(id), true)
  globalThis.fetch = async () => Response.json({ id: 'other', status: 'FINALIZADO', return: { returnedAt: '2026-10-28T00:00:00Z' } })
  await assert.rejects(loans.reconcileReturn(id))
  assert.equal(loans.hasPendingReturn(id), true)
  globalThis.fetch = async () => Response.json({ id, status: 'FINALIZADO', return: {} })
  assert.equal(await loans.reconcileReturn(id), false)
  assert.equal(loans.hasPendingReturn(id), true)
  globalThis.fetch = async () => Response.json({ id, status: 'FINALIZADO', return: { returnedAt: '2026-10-28T00:00:00Z' } })
  assert.equal(await loans.reconcileReturn(id), true)
  assert.equal(loans.hasPendingReturn(id), false)
})

test('altas inciertas: recurso y registro integral no se reenvían por reabrir formulario', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json(null, { status: 500 }) }
  const resource = { nombre: 'Prueba de resultado incierto', categoriaId: 'category-review' }
  await assert.rejects(inventory.saveResource(null, resource), e => e.status === 500)
  await assert.rejects(inventory.saveResource(null, resource), e => e.status === 0 && e.message.includes('pendiente'))
  assert.equal(calls, 1)
  const registration = { name: 'Prueba', email: 'test@example.invalid', password: 'solo-test', userType: 'DOCENTE', evidence: [], termsVersionId: 'terms-review' }
  await assert.rejects(access.requestFullRegistration(registration), e => e.status === 500)
  await assert.rejects(access.requestFullRegistration(registration), e => e.status === 0 && e.message.includes('pendiente'))
  assert.equal(calls, 2)
})

test('apelaciones: fecha ausente o inválida se rechaza antes del ordenamiento', async () => {
  const item = appeal({ id: 'a-review' })
  for (const submittedAt of [undefined, null, 123, '', 'fecha-inválida']) {
    globalThis.fetch = async () => Response.json({ items: [{ ...item, submittedAt }, { ...item, id: 'a-review2', submittedAt }], total: 2, page: 1, limit: 20 })
    await assert.rejects(trust.listAppeals(), e => e.status === 0)
  }
})

test('levantamiento: misma sanción ACTIVA no es éxito y bloquea otro envío incierto', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json({ id: 'sanction-review', status: 'ACTIVA' }) }
  await assert.rejects(trust.liftSanction('sanction-review', 'Fundamento'), e => e.status === 0)
  await assert.rejects(trust.liftSanction('sanction-review', 'Fundamento'), e => e.status === 0)
  assert.equal(calls, 1)
  globalThis.fetch = async () => Response.json(sanction({ id: 'sanction-review-confirmed', status: 'FINALIZADA' }))
  assert.equal((await trust.liftSanction('sanction-review-confirmed', 'Fundamento')).status, 'FINALIZADA')
})

test('estructura del detalle: confirmar reserva no recarga/desmonta el diálogo', async () => {
  const source = await readFile(new URL('../src/modules/inventory/pages/ResourceDetailPage.vue', import.meta.url), 'utf8')
  const { descriptor, errors } = parse(source, { templateParseOptions: { expressionPlugins: ['typescript'] } })
  assert.deepEqual(errors, [])
  const ast = descriptor.template.ast
  let reservation
  const walk = node => {
    if (node.tag === 'ReservationDialog') reservation = node
    for (const child of node.children ?? []) walk(child)
  }
  walk(ast)
  assert.ok(reservation)
  const event = name => reservation.props.find(p => p.type === 7 && p.name === 'on' && p.arg?.content === name)?.exp?.content
  assert.equal(event('created'), 'reservationChanged = true')
  assert.equal(event('close'), 'closeReservation')
  assert.match(descriptor.scriptSetup.content, /function closeReservation\(\)[\s\S]*reserving\.value = false[\s\S]*if \(reservationChanged\.value\)[\s\S]*copies\.refresh\(\)[\s\S]*resource\.refresh\(\)/)
})
