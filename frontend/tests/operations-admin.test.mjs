import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, testEnvironment, session } from './helpers/modules.mjs'
const auth = await load('modules/auth/api/auth-api')
const users = await load('modules/users/api/users-admin-api')
const trust = await load('modules/trust/api/trust-api')
const reservations = await load('modules/loans/api/reservations-api')
const loans = await load('modules/loans/api/loans-api')
beforeEach(() => {
  testEnvironment()
  auth.saveSession(session('ADMINISTRADOR'))
})
test('cuenta: descubrir userId coincidente; PATCH usa accountId, nunca userId', async () => {
  const account = {
    id: 'account1',
    userId: 'user1',
    email: 'test@example.invalid',
    role: 'USUARIO',
    enabled: true,
  }
  let calls = 0
  globalThis.fetch = async (url, options) => {
    calls++
    if (url === '/api/auth/accounts?userId=user1') return Response.json({ items: [account] })
    assert.equal(url, '/api/auth/accounts/account1')
    assert.deepEqual(JSON.parse(options.body), { role: 'OPERADOR' })
    return Response.json({ ...account, role: 'OPERADOR' })
  }
  const found = await users.findAccount('user1')
  await users.updateRole(found, 'OPERADOR')
  assert.equal(calls, 2)
  globalThis.fetch = async () => Response.json({ items: [{ ...account, userId: 'other' }] })
  await assert.rejects(users.findAccount('user1'))
  await assert.rejects(
    users.updateRole({ ...account, role: 'ADMINISTRADOR' }, 'USUARIO'),
    (e) => e.status === 403,
  )
})
test('apelación: ACEPTADA y fundamento, sin APROBADA de maqueta', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/appeals/appeal-success/resolution')
    assert.equal(options.method, 'PATCH')
    assert.deepEqual(JSON.parse(options.body), {
      status: 'ACEPTADA',
      resolution: 'Fundamento real',
    })
    return Response.json({
      id: 'appeal-success',
      status: 'ACEPTADA',
      resolution: 'Fundamento real',
    })
  }
  await trust.resolveAppeal('appeal-success', 'ACEPTADA', ' Fundamento real ')
  await assert.rejects(trust.resolveAppeal('a', 'RECHAZADA', ' '), (e) => e.status === 400)
})
test('resolución incierta: no se repite después de error 500', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json({}, { status: 500 })
  }
  await assert.rejects(trust.resolveAppeal('appeal-uncertain', 'RECHAZADA', 'Fundamento'))
  await assert.rejects(trust.resolveAppeal('appeal-uncertain', 'RECHAZADA', 'Fundamento'))
  assert.equal(calls, 1)
})
test('recogida y cancelación: contratos distintos, sin userId ni hora inventada', async () => {
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/pickup')) {
      assert.equal(options.method, 'POST')
      assert.equal(options.body, undefined)
      return Response.json(
        { id: 'l1', userId: 'u1', copyId: 'c1', status: 'ACTIVO' },
        { status: 201 },
      )
    }
    assert.equal(url, '/api/loans/reservations/res-cancel')
    assert.equal(options.method, 'DELETE')
    assert.deepEqual(JSON.parse(options.body), {})
    return Response.json({ id: 'res-cancel', status: 'CANCELADA' })
  }
  await reservations.pickupReservation('res-pickup')
  await reservations.cancelReservation('res-cancel', '')
})
test('checklist: no se mezcla con devolución y solo confirma las partes recibidas por API', async () => {
  const parts = [{ accessoryId: 'p1', received: false }]
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/loans/l1/return-checklist')
    assert.equal(options.method, 'POST')
    const body = JSON.parse(options.body)
    assert.deepEqual(body.parts, parts)
    assert.equal('returnedAt' in body, false)
    return Response.json({ id: 'ch1', loanId: 'l1', ...body }, { status: 201 })
  }
  await loans.saveReturnChecklist('l1', parts)
  globalThis.fetch = async () =>
    Response.json({ id: 'ch1', loanId: 'l1', parts: [], checkedAt: new Date().toISOString() })
  await assert.rejects(loans.saveReturnChecklist('l1', parts))
})
test('aprobación no crea cuenta; cuenta nueva solo USUARIO y credenciales explícitas', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push(url)
    if (url.endsWith('/approve'))
      return Response.json(
        { request: { id: 'request1', status: 'APROBADA' }, user: { id: 'user1' } },
        { status: 201 },
      )
    assert.equal(url, '/api/auth/accounts')
    assert.deepEqual(JSON.parse(options.body), {
      userId: 'user1',
      email: 'test@example.invalid',
      password: 'solo-test',
      role: 'USUARIO',
    })
    return Response.json({ id: 'account1', userId: 'user1', role: 'USUARIO' }, { status: 201 })
  }
  await users.approveRequest('request1')
  assert.equal(calls.length, 1)
  await users.createAccount({
    userId: 'user1',
    email: 'test@example.invalid',
    password: 'solo-test',
  })
  assert.equal(calls.length, 2)
})
