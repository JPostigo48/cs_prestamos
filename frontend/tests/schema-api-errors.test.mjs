import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, testEnvironment } from './helpers/modules.mjs'

const { apiRequest, ApiError, onUnauthorized } = await load('shared/api/client')
const { errorMessage } = await load('shared/composables/useRemote')
beforeEach(() => testEnvironment())

for (const [diagnostic, message] of [
  ['SCHEMA_INCOMPLETE', 'Operación bloqueada por una actualización pendiente del sistema. Solicite al administrador completar la actualización y vuelva a intentarlo.'],
  ['SCHEMA_UNKNOWN', 'No se pudo verificar la disponibilidad de esta operación. Vuelva a intentarlo; si persiste, contacte al administrador.'],
]) {
  test(`503 de capacidad conserva el contrato seguro: ${diagnostic}`, async () => {
    const serialized = JSON.stringify({ statusCode: 503, code: 'SCHEMA_CAPABILITY_UNAVAILABLE',
      operation: 'loans.close', diagnostic,
      message })
    globalThis.fetch = async () => new Response(serialized, { status: 503 })
    await assert.rejects(apiRequest('/loans/loan/return'), error => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 503)
      assert.equal(error.code, 'SCHEMA_CAPABILITY_UNAVAILABLE')
      assert.equal(error.operation, 'loans.close')
      assert.equal(error.diagnostic, diagnostic)
      assert.equal(error.message, 'La operación no está disponible temporalmente. Intente nuevamente más tarde. [SCHEMA_CAPABILITY_UNAVAILABLE: loans.close]')
      assert.equal(errorMessage(error), error.message)
      return true
    })
  })
  test(`503 con diagnóstico válido ignora mensaje arbitrario: ${diagnostic}`, async () => {
    globalThis.fetch = async () => Response.json({ code: 'SCHEMA_CAPABILITY_UNAVAILABLE',
      operation: 'loans.close', diagnostic, message: 'SQL password provider secret' }, { status: 503 })
    await assert.rejects(apiRequest('/loans/loan/return'), error => {
      assert.equal(error.diagnostic, diagnostic)
      assert.equal(error.message, 'La operación no está disponible temporalmente. Intente nuevamente más tarde. [SCHEMA_CAPABILITY_UNAVAILABLE: loans.close]')
      return true
    })
  })
}
for (const operation of [null, {}, ['loans.close'], 'SELECT * FROM secret', 'https://user:password@host', '<script>alert(1)</script>', 'x'.repeat(200)]) {
  test(`503 no refleja detalles del proveedor ni operación inválida: ${JSON.stringify(operation)}`, async () => {
    globalThis.fetch = async () => Response.json({ code: 'SCHEMA_CAPABILITY_UNAVAILABLE', operation,
      diagnostic: 'SQL secret', message: 'SQL password provider secret', cause: 'private' }, { status: 503 })
    await assert.rejects(apiRequest('/inventory/resources'), error => {
      assert.equal(error.operation, undefined)
      assert.equal(error.diagnostic, undefined)
      assert.equal(error.code, 'SCHEMA_CAPABILITY_UNAVAILABLE')
      assert.doesNotMatch(error.message, /SQL|password|provider|secret|script|https/)
      assert.match(error.message, /SCHEMA_CAPABILITY_UNAVAILABLE/)
      assert.equal('cause' in error, false)
      return true
    })
  })
}
test('errores comunes, validación y handler 401 mantienen su comportamiento', async () => {
  let unauthorized = null
  onUnauthorized(token => { unauthorized = token })
  for (const status of [400, 401, 403, 409, 503]) {
    globalThis.fetch = async () => Response.json({ message: ['Mensaje uno', 'Mensaje dos'] }, { status })
    await assert.rejects(apiRequest('/route', { token: 'session-token' }), error => {
      assert.equal(error.status, status)
      assert.equal(error.message, 'Mensaje uno Mensaje dos')
      assert.equal(error.code, undefined)
      return true
    })
  }
  assert.equal(unauthorized, 'session-token')
})
test('un código de capacidad sin HTTP 503 no reclasifica errores de negocio', async () => {
  globalThis.fetch = async () => Response.json({ code: 'SCHEMA_CAPABILITY_UNAVAILABLE', message: 'Conflicto' }, { status: 409 })
  await assert.rejects(apiRequest('/route'), error => error.status === 409 && error.message === 'Conflicto' && error.code === undefined)
})
test('un fallo de red no se convierte en actualización pendiente', async () => {
  const failure = new TypeError('Failed to fetch')
  globalThis.fetch = async () => { throw failure }
  await assert.rejects(apiRequest('/route'), error => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 0)
    assert.equal(error.message, 'No se pudo conectar con el servidor. Comprueba que el backend esté iniciado.')
    assert.equal(error.code, undefined)
    assert.equal(error.diagnostic, undefined)
    assert.equal(error.operation, undefined)
    assert.doesNotMatch(errorMessage(error), /actualización pendiente|SCHEMA_INCOMPLETE/)
    return true
  })
})
