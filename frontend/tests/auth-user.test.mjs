import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, nextTick } from 'vue'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model, text } from './helpers/renderer.mjs'
const auth = await load('modules/auth/api/auth-api')
const access = await load('modules/auth/api/access-flows-api')
const reservations = await load('modules/loans/api/reservations-api')
const { useRemote } = await load('shared/composables/useRemote')
const Registration = await loadComponent('modules/auth/pages/RegistrationRequestPage')
const TermsPanel = await loadComponent('modules/auth/components/TermsPanel')
const MyTerms = await loadComponent('modules/auth/components/MyTermsPanel')
const TermsDocument = await loadComponent('modules/auth/components/TermsDocument')
const { confirmMutation } = await load('shared/api/mutation-guard')
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII='
const terms = { id: 'terms-registration', number: 1, title: 'Condiciones vigentes', content: '# Condiciones\n\nDocumento completo.\n\nÚltimo apartado.' }
function imageFile(source = png) {
  const bytes = Buffer.from(source.split(',')[1], 'base64')
  return { type: source.slice(5, source.indexOf(';')), size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
}
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
test('registro único usa alta integral; el consumidor básico deja de exportarse', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return Response.json({ id: 'request1', status: 'PENDIENTE' }, { status: 201 })
  }
  assert.equal('submitRegistrationRequest' in auth, false)
  await access.requestFullRegistration({
    name: 'Prueba',
    userType: 'DOCENTE',
    email: 'test@unsa.edu.pe',
    password: 'solo-test',
    institutionalId: 'DOC-123',
    phone: '999123456',
    evidence: [png],
    termsVersionId: 't1',
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/auth/registration-requests')
  assert.equal(calls[0].body.password, 'solo-test')
  assert.equal(calls[0].body.termsVersionId, 't1')
})

test('registro público: un formulario, contraseña para todos, imagen y aceptación explícita; aprobación pendiente', async () => {
  auth.clearSession(); confirmMutation('full-registration')
  const previousImage = globalThis.Image
  globalThis.Image = class { naturalWidth = 1; naturalHeight = 1; async decode() {} }
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    assert.equal(options.headers.Authorization, undefined)
    return Response.json(options.method === 'POST' ? { id: 'public-registration', status: 'PENDIENTE' } : terms)
  }
  const app = mount(Registration)
  try {
    assert.equal(findAll(app.root, node => node.tag === 'form').length, 1)
    assert.equal(calls.length, 0)
    assert.match(text(app.root), /Argon2id/)
    assert.match(text(app.root), /carné o constancia de matrícula vigente/)
    assert.match(text(app.root), /no será visible para operadores ni administradores/)
    const inputs = findAll(app.root, node => node.tag === 'input')
    const password = inputs.find(node => node.props.id === 'registration-password')
    assert.equal(password.props.type, 'password')
    await event(find(app.root, 'button', 'Mostrar contraseña'), 'click')
    assert.equal(password.props.type, 'text')
    await event(find(app.root, 'button', 'Ocultar contraseña'), 'click')
    assert.equal(password.props.type, 'password')
    for (const type of ['DOCENTE', 'ADMINISTRATIVO', 'ESTUDIANTE']) {
      await model(find(app.root, 'select'), type)
      assert.equal(password.props.required, '')
    }
    const professor = findAll(app.root, node => node.tag === 'option').find(node => node.props.value === 'DOCENTE')
    assert.equal(text(professor), 'Profesor')
    await model(inputs[0], ' Solicitante público ')
    await model(inputs[1], ' user@unsa.edu.pe ')
    await model(password, 'ClaveElegida-2026!')
    await model(inputs[3], 'DOC-123')
    await model(inputs[4], '999123456')
    const file = inputs.find(node => node.props.type === 'file')
    await event(file, 'change', { target: { files: [imageFile()] } })
    assert.equal(find(app.root, 'img').props.src, png)
    assert.equal(find(app.root, 'button', 'Enviar solicitud').props.disabled, true)
    await event(find(app.root, 'button', 'Consultar términos actuales'), 'click')
    const dialog = find(app.root, 'dialog')
    assert.equal(dialog.open, true)
    assert.match(text(dialog), /Último apartado/)
    const checkbox = findAll(app.root, node => node.tag === 'input' && node.props.type === 'checkbox')[0]
    assert.equal(dialog.contains(checkbox), false)
    assert.equal(checkbox.checked, false)
    assert.equal(checkbox.props.disabled, false)
    await event(find(app.root, 'button', 'Cerrar documento'), 'click')
    await model(checkbox, true); await event(checkbox, 'change')
    assert.equal(find(app.root, 'button', 'Enviar solicitud').props.disabled, false)
    await event(find(app.root, 'form'), 'submit')
    const sent = calls.filter(call => call.options.method === 'POST')
    assert.equal(sent.length, 1)
    assert.equal(sent[0].url, '/api/auth/registration-requests')
    assert.deepEqual(JSON.parse(sent[0].options.body), { name: 'Solicitante público', email: 'user@unsa.edu.pe', password: 'ClaveElegida-2026!', userType: 'ESTUDIANTE', institutionalId: 'DOC-123', phone: '999123456', evidence: [png], termsVersionId: terms.id })
    assert.match(text(app.root), /PENDIENTE/)
    assert.equal(password.value, '')
    assert.equal(auth.getSession(), null)
    await event(find(app.root, 'form'), 'submit')
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 1)
  } finally { app.unmount(); globalThis.Image = previousImage }
})

test('términos: apertura/carga completa, sin autoselección; recarga, nueva versión y fallo invalidan aceptación', async () => {
  let resolveTerms
  let current = terms
  let fail = false
  globalThis.fetch = async () => fail ? Response.json({}, { status: 503 }) : new Promise(resolve => { resolveTerms = () => resolve(Response.json(current)) })
  const acceptedVersions = []
  const app = mount(TermsPanel, { onRead: value => acceptedVersions.push(value) })
  const checkbox = () => findAll(app.root, node => node.tag === 'input' && node.props.type === 'checkbox')[0]
  try {
    assert.equal(checkbox().props.disabled, true)
    const opening = event(find(app.root, 'button', 'Consultar términos actuales'), 'click')
    await flush()
    assert.equal(checkbox().props.disabled, true)
    resolveTerms(); await opening
    assert.equal(checkbox().props.disabled, false)
    assert.equal(checkbox().checked, false)
    // El host virtual no implementa layout/selector DOM: solo adaptar estos
    // controles para comprobar el ciclo de teclado del modal ya montado.
    const dialog = find(app.root, 'dialog')
    const controls = findAll(dialog, node => node.tag === 'button')
    for (const control of controls) {
      control.tabIndex = 0
      control.matches = () => !!control.props.disabled
      control.closest = () => null
      control.getClientRects = () => [{}]
    }
    dialog.querySelectorAll = () => controls
    let prevented = 0
    controls.at(-1).focus()
    await event(dialog, 'keydown', { key: 'Tab', preventDefault() { prevented++ } })
    assert.equal(document.activeElement, controls[0])
    await event(dialog, 'keydown', { key: 'Tab', shiftKey: true, preventDefault() { prevented++ } })
    assert.equal(document.activeElement, controls.at(-1))
    assert.equal(prevented, 2)
    await model(checkbox(), true); await event(checkbox(), 'change')
    assert.equal(acceptedVersions.at(-1), terms.id)
    const reloading = event(find(app.root, 'button', 'Actualizar versión'), 'click')
    await flush()
    assert.equal(checkbox().props.disabled, true)
    assert.equal(checkbox().checked, false)
    assert.equal(acceptedVersions.at(-1), null)
    current = { ...terms, id: 'terms-new', number: 2, content: 'Nuevo contenido completo' }
    resolveTerms(); await reloading
    assert.match(text(find(app.root, 'dialog')), /Nuevo contenido completo/)
    assert.equal(checkbox().checked, false)
    await model(checkbox(), true); await event(checkbox(), 'change')
    assert.equal(acceptedVersions.at(-1), 'terms-new')
    fail = true
    await event(find(app.root, 'button', 'Actualizar versión'), 'click')
    assert.equal(checkbox().props.disabled, true)
    assert.equal(checkbox().checked, false)
    assert.equal(acceptedVersions.at(-1), null)
    assert.ok(find(app.root, 'button', 'Volver a intentar'))
  } finally { app.unmount() }
})

test('imagen: cambiar o cancelar una selección invalida una lectura anterior aún pendiente', async () => {
  auth.clearSession(); confirmMutation('full-registration')
  const previousImage = globalThis.Image
  let resolveDecode
  globalThis.Image = class { naturalWidth = 1; naturalHeight = 1; decode() { return new Promise(resolve => { resolveDecode = resolve }) } }
  const app = mount(Registration)
  try {
    const input = findAll(app.root, node => node.tag === 'input' && node.props.type === 'file')[0]
    const reading = event(input, 'change', { target: { files: [imageFile()] } })
    await flush()
    assert.match(text(app.root), /Validando imagen/)
    await event(input, 'change', { target: { files: [] } })
    resolveDecode(); await reading
    assert.equal(find(app.root, 'img'), undefined)
    assert.equal(find(app.root, 'button', 'Enviar solicitud').props.disabled, true)
    const readingAgain = event(input, 'change', { target: { files: [imageFile()] } })
    await flush()
    await event(input, 'change', { target: { files: [{ ...imageFile(), type: 'image/svg+xml' }] } })
    resolveDecode(); await readingAgain
    assert.equal(find(app.root, 'img'), undefined)
    assert.match(text(app.root), /PNG o JPEG válida/)
  } finally { app.unmount(); globalThis.Image = previousImage }
})

test('registro: un resultado incierto mantiene el formulario bloqueado al remontar sin almacenar credenciales', async () => {
  auth.clearSession(); confirmMutation('full-registration')
  let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json({}, { status: 500 }) }
  const body = { name: 'Prueba', email: 'public@unsa.edu.pe', password: 'NO-PERSISTIR-CLAVE', userType: 'ESTUDIANTE', institutionalId: 'DOC-123', phone: '999123456', evidence: [png], termsVersionId: terms.id }
  await assert.rejects(access.requestFullRegistration(body))
  try {
    for (let i = 0; i < 2; i++) {
      const app = mount(Registration)
      try {
        assert.equal(find(app.root, 'fieldset').props.disabled, true)
        assert.equal(find(app.root, 'button', 'Enviar solicitud').props.disabled, true)
        assert.match(text(app.root), /resultado incierto/)
        await event(find(app.root, 'form'), 'submit')
        assert.equal(calls, 1)
      } finally { app.unmount() }
    }
    const marker = sessionStorage.getItem('cs-mutation-pending:public:full-registration')
    assert.ok(marker)
    assert.doesNotMatch(marker, /NO-PERSISTIR-CLAVE|public@unsa|base64/)
  } finally { confirmMutation('full-registration') }
})

test('documento de términos usa nodos seguros: HTML y enlaces ejecutables nunca se interpretan', () => {
  const app = mount(TermsDocument, { content: '# Título\n\n<script>alert(1)</script>\n\n[No ejecutar](javascript:alert) [Seguro](https://example.invalid)\n\n**Texto**' })
  try {
    assert.equal(find(app.root, 'script'), undefined)
    assert.equal(findAll(app.root, node => node.tag === 'a').length, 1)
    assert.equal(find(app.root, 'a').props.href, 'https://example.invalid')
    assert.equal(find(app.root, 'a').props.rel, 'noopener noreferrer')
    assert.match(text(app.root), /<script>alert\(1\)<\/script>/)
    assert.ok(find(app.root, 'strong', 'Texto'))
  } finally { app.unmount() }
})

test('mis términos: documento completo habilita casilla sin selección; aceptación incierta impide reenviar al reabrir', async () => {
  let posts = 0
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') { posts++; return Response.json({}, { status: 500 }) }
    return Response.json(url.endsWith('/terms/current') ? terms : [])
  }
  const app = mount(MyTerms)
  try {
    await flush()
    await event(find(app.root, 'button', 'Condiciones vigentes'), 'click')
    let checkbox = findAll(app.root, node => node.tag === 'input' && node.props.type === 'checkbox')[0]
    assert.equal(checkbox.props.disabled, false)
    assert.equal(checkbox.checked, false)
    await model(checkbox, true)
    await event(find(app.root, 'button', 'Aceptar términos'), 'click')
    assert.equal(posts, 1)
    assert.match(text(app.root), /Resultado incierto/)
    await event(findAll(app.root, node => node.tag === 'button' && node.props['aria-label'] === 'Cerrar diálogo')[0], 'click')
    await event(find(app.root, 'button', 'Condiciones vigentes'), 'click')
    assert.equal(find(app.root, 'button', 'Aceptar términos'), undefined)
    assert.match(text(app.root), /Resultado incierto/)
    assert.equal(posts, 1)
  } finally { app.unmount() }
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
test('consultas a demanda: no ejecutan red al montar ni reintentan automáticamente', async () => {
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
