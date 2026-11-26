import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, text } from './helpers/renderer.mjs'
const auth = await load('modules/auth/api/auth-api')
const access = await load('modules/auth/api/access-flows-api')
const users = await load('modules/users/api/users-admin-api')
const { readRegistrationImage, registrationImageSource, MAX_REGISTRATION_IMAGE_BYTES } = await load('modules/auth/registration-image')
const { registrationApprovalBlockers } = await load('modules/users/registration-review')
const { confirmMutation, pendingMutation } = await load('shared/api/mutation-guard')
const ProjectApi = await loadComponent('modules/project-showcase/pages/ProjectApiPage')
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

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII='
const pngBytes = Buffer.from(png.split(',')[1], 'base64')
function file(bytes, type = 'image/png', size = bytes.length) {
  return { type, size, arrayBuffer: async () => Uint8Array.from(bytes).buffer }
}

test('evidencia: límite 60 KiB, firma real coherente con MIME y decodificación; rechaza archivos disfrazados', async () => {
  const previousImage = globalThis.Image
  let decodes = 0
  globalThis.Image = class { naturalWidth = 1; naturalHeight = 1; async decode() { decodes++ } }
  try {
    assert.equal(MAX_REGISTRATION_IMAGE_BYTES, 61440)
    assert.equal(await readRegistrationImage(file(pngBytes)), png)
    assert.equal(registrationImageSource(png), png)
    const jpeg = Buffer.from([255, 216, 255, 224, 0, 2, 255, 217])
    assert.match(await readRegistrationImage(file(jpeg, 'image/jpeg')), /^data:image\/jpeg;base64,/)
    const boundary = Buffer.alloc(MAX_REGISTRATION_IMAGE_BYTES)
    pngBytes.copy(boundary); pngBytes.subarray(-12).copy(boundary, boundary.length - 12)
    await readRegistrationImage(file(boundary))
    assert.equal(decodes, 3)
    for (const invalid of [
      file(pngBytes, 'image/gif'), file(pngBytes, 'image/jpeg'), file(jpeg, 'image/png'),
      file(Buffer.from('<svg onload="alert(1)">')), file(Buffer.alloc(0)),
      file(pngBytes, 'image/png', MAX_REGISTRATION_IMAGE_BYTES + 1),
      file(pngBytes, 'image/png', pngBytes.length - 1), file(pngBytes.subarray(0, -1)),
    ]) await assert.rejects(readRegistrationImage(invalid), /PNG o JPEG válida/)
    assert.equal(decodes, 3)
    globalThis.Image = class { async decode() { throw new Error('corrupta') } }
    await assert.rejects(readRegistrationImage(file(pngBytes)), /PNG o JPEG válida/)
    globalThis.Image = class { naturalWidth = 0; naturalHeight = 0; async decode() {} }
    await assert.rejects(readRegistrationImage(file(pngBytes)), /PNG o JPEG válida/)
    for (const invalid of ['https://example.invalid/image.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YWJj', png.replace('image/png', 'image/jpeg'), 'data:image/png;base64,%%%=', null])
      assert.equal(registrationImageSource(invalid), null)
  } finally { globalThis.Image = previousImage }
})

test('contrato de revisión: approvalBlockers vacío permite; ausente, inválido o incompleto bloquea con motivos locales seguros', async () => {
  const complete = { id: 'registration-complete', evidence: [{ information: png }], approvalBlockers: [] }
  globalThis.fetch = async () => Response.json({ items: [complete], total: 1, page: 1, limit: 20 })
  const response = await users.listRegistrationRequests({ status: 'PENDIENTE' })
  assert.deepEqual(response.items[0].approvalBlockers, [])
  assert.deepEqual(registrationApprovalBlockers(response.items[0]), [])
  for (const message of [
    'Falta un correo institucional válido.',
    'Faltan credenciales válidas del registro integral.',
    'Falta la aceptación válida de una versión de términos existente.',
    'Falta una imagen PNG o JPEG válida de hasta 60 KiB.',
  ]) {
    const reasons = registrationApprovalBlockers({ ...complete, approvalBlockers: [message] })
    assert.equal(reasons.length, 1)
    assert.doesNotMatch(reasons[0], /requiere revisión|passwordHash/)
  }
  for (const approvalBlockers of [undefined, null, ['MISSING_CREDENTIALS'], ['MISSING_TERMS_ACCEPTANCE'], [false], [''], ['passwordHash=NO-DIVULGAR'], ['__proto__'], ['constructor']]) {
    const reasons = registrationApprovalBlockers({ ...complete, approvalBlockers })
    assert.ok(reasons.length)
    assert.ok(reasons.every(reason => typeof reason === 'string'))
    assert.doesNotMatch(reasons.join(' '), /NO-DIVULGAR|passwordHash/)
  }
  assert.ok(registrationApprovalBlockers({ ...complete, evidence: [] }).length)
  assert.ok(registrationApprovalBlockers({ ...complete, evidence: [{ information: 'Texto antiguo' }] }).length)
})

test('registro incierto o respuesta 2xx incompatible bloquean repetición; 4xx conocido permite corregir', async () => {
  const body = { name: 'Prueba', email: 'user@unsa.edu.pe', password: 'Clave-2026!', userType: 'DOCENTE', institutionalId: 'DOC-123', phone: '999123456', evidence: [png], termsVersionId: 'terms' }
  let calls = 0
  try {
    for (const response of [Response.json({}, { status: 500 }), Response.json({ status: 'APROBADA' })]) {
      confirmMutation('full-registration')
      globalThis.fetch = async () => { calls++; return response }
      await assert.rejects(access.requestFullRegistration(body))
      assert.equal(pendingMutation('full-registration'), true)
      const before = calls
      await assert.rejects(access.requestFullRegistration(body), /incierto/)
      assert.equal(calls, before)
    }
    confirmMutation('full-registration')
    globalThis.fetch = async () => Response.json({}, { status: 409 })
    await assert.rejects(access.requestFullRegistration(body), error => error.status === 409)
    assert.equal(pendingMutation('full-registration'), false)
  } finally { confirmMutation('full-registration') }
})

test('showcase API presenta summary y description simultáneamente sin interpretar HTML', async () => {
  globalThis.fetch = async () => Response.json({ paths: { '/auth/registration-requests': { post: {
    summary: 'Solicitud integral', description: 'La aprobación crea la cuenta original. <script>no ejecutar</script>', tags: ['Auth'],
    'x-implementation-status': 'implemented',
  } } } })
  const app = mount(ProjectApi)
  try {
    await flush()
    assert.match(text(app.root), /Solicitud integral/)
    assert.match(text(app.root), /La aprobación crea la cuenta original/)
    assert.equal(find(app.root, 'script'), undefined)
  } finally { app.unmount() }
})
