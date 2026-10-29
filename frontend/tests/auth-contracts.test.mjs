import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, testEnvironment, session } from './helpers/modules.mjs'
const auth = await load('modules/auth/api/auth-api')
const access = await load('modules/auth/api/access-flows-api')
const users = await load('modules/users/api/users-admin-api')
beforeEach(() => { testEnvironment(); auth.saveSession(session('ADMINISTRADOR')) })

test('F02 consume términos reales públicos y rechaza contenido ilegible', async () => {
  const terms = { id: 'terms', number: 3, title: 'Términos', content: 'Contenido vigente', policies: [] }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/terms/current')
    assert.equal(options.headers.Authorization, undefined)
    return Response.json(terms)
  }
  assert.deepEqual(await access.getCurrentTerms(), terms)
  for (const result of [{}, { ...terms, content: '' }, { ...terms, number: 0 }]) {
    globalThis.fetch = async () => Response.json(result)
    await assert.rejects(access.getCurrentTerms())
  }
})
test('F01 no autentica por correo, rechaza URLs inseguras y muestra fallo de configuración', async () => {
  for (const authorizationUrl of ['http://accounts.google.com/auth', 'https://evil.invalid', 'https://user:pass@accounts.google.com/auth']) {
    globalThis.fetch = async () => Response.json({ authorizationUrl })
    await assert.rejects(access.startGoogle('user@unsa.edu.pe'))
  }
  globalThis.fetch = async () => Response.json({ message: 'Google no está configurado.' }, { status: 503 })
  await assert.rejects(access.startGoogle('user@unsa.edu.pe'), (e) => e.status === 503)
  assert.equal(auth.getSession().user.role, 'ADMINISTRADOR')
})
test('callback intercambia código y state, no acepta sesión incompatible', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/auth/google/authenticate')
    assert.deepEqual(JSON.parse(options.body), { code: 'one-time-code', state: 'opaque-state' })
    return Response.json({ accessToken: 'verified-jwt', tokenType: 'Bearer', expiresIn: 300, user: session().user })
  }
  assert.equal((await access.finishGoogle('one-time-code', 'opaque-state')).accessToken, 'verified-jwt')
  globalThis.fetch = async () => Response.json({ email: 'untrusted@unsa.edu.pe' })
  await assert.rejects(access.finishGoogle('code', 'state'))
})
test('F10 usa userId para descubrir accountId real; vacío o ajeno bloquean cambios', async () => {
  const account = { id: 'account-real', userId: 'user-real', email: 'user@unsa.edu.pe', role: 'USUARIO', enabled: true, lastAccessAt: null }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/auth/accounts?userId=user-real')
    assert.equal(options.headers.Authorization, 'Bearer offline-test-token')
    return Response.json({ items: [account] })
  }
  assert.equal((await users.findAccount('user-real')).id, 'account-real')
  for (const items of [[], [{ ...account, userId: 'another' }], [{ ...account, enabled: undefined }]]) {
    globalThis.fetch = async () => Response.json({ items })
    await assert.rejects(users.findAccount('user-real'))
  }
})
