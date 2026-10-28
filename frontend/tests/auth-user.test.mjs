import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, nextTick } from 'vue'
import { load, testEnvironment, session } from './helpers/modules.mjs'
const auth = await load('modules/auth/api/auth-api')
const access = await load('modules/auth/api/access-flows-api')
const reservations = await load('modules/loans/api/reservations-api')
const { useRemote } = await load('shared/composables/useRemote')
beforeEach(() => {
  testEnvironment()
  auth.saveSession(session())
})
test('login: 201 válido, no credenciales precargadas ni sesión desde 2xx incompatible', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/auth/authenticate')
    assert.deepEqual(JSON.parse(options.body), {
      email: 'test@example.invalid',
      password: 'solo-test',
    })
    return Response.json({ ...session(), expiresIn: 300 }, { status: 201 })
  }
  const result = await auth.authenticate('test@example.invalid', 'solo-test')
  assert.equal(result.user.id, session().user.id)
  assert.ok(result.expiresAt > Date.now())
  for (const body of [
    null,
    {},
    { ...session(), expiresIn: -1 },
    { ...session('DOCENTE'), expiresIn: 300 },
  ]) {
    globalThis.fetch = async () => Response.json(body)
    await assert.rejects(
      auth.authenticate('test@example.invalid', 'solo-test'),
      (e) => e.status === 0,
    )
  }
})
test('aceptación: usuario y versión efectivamente leída, fecha ISO y confirmación coincidente', async () => {
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body)
    assert.equal(url, '/api/terms/acceptances')
    assert.equal(options.method, 'POST')
    assert.equal(body.userId, session().user.id)
    assert.equal(body.termsVersionId, 'terms1')
    assert.equal(new Date(body.acceptedAt).toISOString(), body.acceptedAt)
    return Response.json({ id: 'acceptance1', ...body }, { status: 201 })
  }
  assert.equal((await access.acceptTerms(session().user.id, 'terms1')).termsVersionId, 'terms1')
  globalThis.fetch = async () =>
    Response.json({ id: 'a', userId: 'other', termsVersionId: 'terms1' })
  await assert.rejects(access.acceptTerms(session().user.id, 'terms1'))
})
test('alta integral y solicitud básica son envíos diferentes, sin propiedades ajenas', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return Response.json({ id: 'request1', status: 'PENDIENTE' }, { status: 201 })
  }
  await auth.submitRegistrationRequest({ name: 'Prueba', userType: 'DOCENTE', evidence: ['Texto'] })
  assert.deepEqual(
    calls.map((c) => c.url),
    ['/api/users/registration-requests'],
  )
  assert.equal('password' in calls[0].body, false)
  assert.equal('termsVersionId' in calls[0].body, false)
  await access.requestFullRegistration({
    name: 'Prueba',
    userType: 'DOCENTE',
    email: 'test@example.invalid',
    password: 'solo-test',
    evidence: [],
    termsVersionId: 't1',
  })
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, '/api/auth/registration-requests')
})
test('reservar: ejemplar y hora futura sin userId, validación y confirmación', async () => {
  let calls = 0
  globalThis.fetch = async (url, options) => {
    calls++
    assert.equal(url, '/api/loans/reservations')
    assert.equal(options.method, 'POST')
    const body = JSON.parse(options.body)
    assert.deepEqual(Object.keys(body), ['copyId', 'requestedAt'])
    assert.equal(body.copyId, 'copy-success')
    return Response.json(
      { id: 'r1', userId: session().user.id, copyId: body.copyId, status: 'CONFIRMADA', pickupDeadline: body.requestedAt },
      { status: 201 },
    )
  }
  await assert.rejects(reservations.createReservation('c1', '2020-01-01'))
  assert.equal(calls, 0)
  assert.equal(
    (
      await reservations.createReservation(
        'copy-success',
        new Date(Date.now() + 600000).toISOString(),
      )
    ).id,
    'r1',
  )
  assert.equal(calls, 1)
})
test('reserva incierta: doble envío y reapertura bloqueados, 409 no se reintenta', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json({ message: 'Error' }, { status: 500 })
  }
  const date = new Date(Date.now() + 600000).toISOString()
  await assert.rejects(reservations.createReservation('copy-uncertain', date))
  await assert.rejects(reservations.createReservation('copy-uncertain', date), (e) =>
    e.message.includes('pendiente'),
  )
  assert.equal(calls, 1)
  globalThis.fetch = async () => {
    calls++
    return Response.json({ message: 'Conflicto' }, { status: 409 })
  }
  await assert.rejects(
    reservations.createReservation('copy-conflict', date),
    (e) => e.status === 409,
  )
  assert.equal(calls, 2)
})
test('consultas provisionales a demanda: no ejecutan red al montar ni reintentan automáticamente', async () => {
  const scope = effectScope()
  let calls = 0,
    remote
  scope.run(() => {
    remote = useRemote(
      async () => {
        calls++
        throw new Error('404 de prueba')
      },
      () => true,
      false,
    )
  })
  await nextTick()
  assert.equal(calls, 0)
  await remote.refresh()
  await nextTick()
  assert.equal(calls, 1)
  assert.match(remote.error.value, /404/)
  await nextTick()
  assert.equal(calls, 1)
  scope.stop()
})
