import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, testEnvironment, session } from './helpers/modules.mjs'
const api = await load('shared/api/provisional-contracts')
const auth = await load('modules/auth/api/auth-api')
beforeEach(() => {
  testEnvironment()
  auth.saveSession(session('ADMINISTRADOR'))
})
const fixtures = {
  F01: { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test' },
  F02: {
    id: 't1',
    number: 1,
    title: 'Términos de test',
    content: 'Contenido leído solo en pruebas.',
  },
  F03: { id: 'registration1', status: 'PENDIENTE' },
  F04: { items: [{ id: 'a1', userId: 'u1', reason: 'Revisión', status: 'PENDIENTE', submittedAt: '2026-10-28T00:00:00Z' }], total: 1 },
  F05: { id: 's/1', status: 'ACTIVA', startsAt: '2026-10-28T00:00:00Z', endsAt: null },
  F06: { items: [{ id: 'p1', nombre: 'Cargador' }] },
  F07: { items: [{ id: 'p1', nombre: 'Cargador' }] },
  F08: {
    items: [
      { id: 'l1', userId: 'u1', copyId: 'c1', endsAt: '2026-10-28T00:00:00Z', status: 'ACTIVO' },
    ],
  },
  F09: {
    id: 'check1',
    loanId: 'l1',
    parts: [{ accessoryId: 'p1', received: false }],
    checkedAt: '2026-10-28T00:00:00Z',
  },
  F10: {
    items: [
      {
        id: 'account1',
        userId: 'u1',
        email: 'test@example.invalid',
        enabled: true,
        role: 'OPERADOR',
      },
    ],
  },
  F11: { id: 's1', userId: 'u1', status: 'ACTIVA', startsAt: '2026-10-28T00:00:00Z', endsAt: null },
  F12: { id: 's1', status: 'FINALIZADA' },
  F13: { resourceId: 'r1', durationHours: 12 },
  F14: {
    items: [
      {
        id: 'r1',
        userId: 'u1',
        copyId: 'c1',
        requestedAt: '2026-10-28T00:00:00Z',
        pickupDeadline: '2026-10-28T00:30:00Z',
        status: 'CONFIRMADA',
      },
    ],
    total: 1,
  },
}
for (const [id, contract] of Object.entries(api.provisionalContracts)) {
  test(`${id}: ruta central, método, autenticación y respuesta confirmada`, async () => {
    let calls = 0
    const params = { userId: 'u/1', resourceId: 'r/1', sanctionId: 's/1', loanId: 'l/1' }
    const query = ['F04', 'F10', 'F14'].includes(id) ? { userId: 'u & 1' } : undefined
    const body =
      contract.method === 'GET' ? undefined : { test: 'payload no registrado fuera de tests' }
    globalThis.fetch = async (url, options) => {
      calls++
      let expected = contract.path.replace(/:(\w+)/g, (_, key) => encodeURIComponent(params[key]))
      if (query) expected += '?' + new URLSearchParams(query)
      assert.equal(url, '/api' + expected)
      assert.equal(options.method, contract.method)
      assert.equal(
        options.headers.Authorization,
        ['F01', 'F02', 'F03'].includes(id) ? undefined : 'Bearer offline-test-token',
      )
      assert.deepEqual(options.body === undefined ? undefined : JSON.parse(options.body), body)
      return Response.json(fixtures[id], { status: contract.method === 'POST' ? 201 : 200 })
    }
    assert.deepEqual(await api.provisionalRequest(id, { params, query, body }), fixtures[id])
    assert.equal(calls, 1)
  })
  test(`${id}: HTTP, red y 2xx inválido nunca producen fallback ni reintento`, async () => {
    const params = { userId: 'u1', resourceId: 'r1', sanctionId: 's1', loanId: 'l1' }
    for (const status of [400, 401, 403, 404, 405, 409, 500, 503]) {
      let calls = 0
      globalThis.fetch = async () => {
        calls++
        return Response.json({ message: 'Error de prueba' }, { status })
      }
      await assert.rejects(
        api.provisionalRequest(id, { params }),
        (e) =>
          e.status === status &&
          e.message.includes(id) &&
          e.message.includes('Contrato provisional'),
      )
      assert.equal(calls, 1)
    }
    for (const payload of [null, {}, [], { items: null }, { id: 'sin-estado' }]) {
      let calls = 0
      globalThis.fetch = async () => {
        calls++
        return Response.json(payload)
      }
      await assert.rejects(api.provisionalRequest(id, { params }), (e) => e.status === 0)
      assert.equal(calls, 1)
    }
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      throw new TypeError('offline')
    }
    await assert.rejects(api.provisionalRequest(id, { params }), (e) => e.status === 0)
    assert.equal(calls, 1)
  })
}
test('Google: URL no HTTPS, host falso o credenciales en URL se rechazan', () => {
  for (const authorizationUrl of [
    'http://accounts.google.com/auth',
    'https://evil.invalid/auth',
    'https://accounts.google.com.evil.invalid',
    'https://user:pass@accounts.google.com/auth',
  ])
    assert.equal(api.validProvisional('F01', { authorizationUrl }), false)
})
test('No enviar rutas con placeholders sin resolver', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    throw new Error('No debe llegar a red')
  }
  await assert.rejects(api.provisionalRequest('F05'), (e) => e.status === 400)
  assert.equal(calls, 0)
})
