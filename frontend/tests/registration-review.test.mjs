import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model, text } from './helpers/renderer.mjs'
const auth = await load('modules/auth/api/auth-api')
const api = await load('modules/auth/api/access-flows-api')
const users = await load('modules/users/api/users-admin-api')
const policy = await load('modules/auth/registration-policy')
const { readRegistrationEvidence } = await load('modules/auth/registration-image')
const { confirmMutation, pendingMutation } = await load('shared/api/mutation-guard')
const Page = await loadComponent('modules/users/pages/RegistrationRequestsPage')
const Form = await loadComponent('modules/auth/components/FullRegistrationForm')
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC'
const pdf = JSON.stringify({ kind: 'pdf', bucket: 'loan-evidence', path: 'registration-evidence/123e4567-e89b-42d3-a456-426614174003.pdf', originalName: 'constancia.pdf', mimeType: 'application/pdf', sizeBytes: 100, hash: 'a'.repeat(64) })
const item = (id = 'request') => ({ id, name: 'Solicitante ' + id, userType: 'DOCENTE', institutionalId: 'DOC-1', phone: '999123456', status: 'PENDIENTE', evidence: [{ information: pdf }], approvedUserId: null, rejectionReason: null, approvalBlockers: [] })
const page = (items, total = items.length, number = 1) => ({ items, total, page: number, limit: 20 })
const signed = (token = 'new') => 'https://project.supabase.co/storage/v1/object/sign/loan-evidence/registration-evidence/123e4567-e89b-42d3-a456-426614174003.pdf?token=' + token
const body = () => ({ name: ' Nombre completo ', email: ' USER@UNSA.EDU.PE ', password: ' legitimate edge password ', userType: 'DOCENTE', institutionalId: ' DOC-1 ', phone: ' 999123456 ', evidence: [png], termsVersionId: '123e4567-e89b-42d3-a456-426614174003' })
beforeEach(() => { testEnvironment(); auth.saveSession(session('OPERADOR')); confirmMutation('full-registration') })

for (const role of ['OPERADOR', 'ADMINISTRADOR']) {
  test(`${role}: empty → new request → same normalized filters refresh without remount; changed filters only one request`, async () => {
    auth.saveSession(session(role))
    let items = [], calls = 0
    globalThis.fetch = async () => { calls++; return Response.json(page(items)) }
    const app = mount(Page)
    try {
      await flush(); assert.match(text(app.root), /No hay solicitudes/); assert.equal(calls, 1)
      items = [item()]
      await event(find(app.root, 'form'), 'submit')
      assert.match(text(app.root), /Solicitante request/); assert.equal(calls, 2)
      await model(find(app.root, 'input'), ' DOC-1 ')
      await event(find(app.root, 'form'), 'submit'); assert.equal(calls, 3)
      await model(find(app.root, 'input'), 'DOC-1')
      await event(find(app.root, 'form'), 'submit'); assert.equal(calls, 4)
    } finally { app.unmount() }
  })
  test(`${role}: PDF error outside decision modal, accessible retry, one signature per gesture, renewal and safe native link`, async () => {
    auth.saveSession(session(role))
    let signCalls = 0, resolveSign
    globalThis.fetch = async url => {
      if (url.includes('/evidence/')) {
        signCalls++
        if (signCalls === 1) return Response.json({ message: 'No se pudo generar el acceso a la evidencia.' }, { status: 422 })
        return new Promise(resolve => { resolveSign = () => resolve(Response.json({ url: signed(String(signCalls)) })) })
      }
      return Response.json(page([item(), item('other')]))
    }
    const app = mount(Page)
    try {
      await flush()
      const first = () => findAll(app.root, n => n.tag === 'button' && text(n).includes('constancia PDF'))[0]
      await event(first(), 'click')
      assert.equal(find(app.root, 'dialog'), undefined)
      assert.match(text(find(app.root, 'article')), /No se pudo generar/)
      assert.ok(find(app.root, 'button', 'Reintentar abrir PDF'))
      const retry = find(app.root, 'button', 'Reintentar abrir PDF')
      const pending = event(retry, 'click'); await flush()
      await event(retry, 'click'); assert.equal(signCalls, 2)
      assert.equal(retry.props.disabled, true)
      resolveSign(); await pending
      let link = find(app.root, 'a', 'Ver PDF')
      assert.equal(link.props.href, signed('2')); assert.equal(link.props.target, '_blank'); assert.equal(link.props.rel, 'noopener noreferrer')
      await event(link, 'click'); await new Promise(resolve => setTimeout(resolve, 5)); await flush()
      assert.equal(find(app.root, 'a', 'Ver PDF'), undefined)
      const renew = event(first(), 'click'); await flush(); assert.equal(signCalls, 3)
      resolveSign(); await renew
      assert.equal(find(app.root, 'a', 'Ver PDF').props.href, signed('3'))
      assert.doesNotMatch(JSON.stringify([...Array(localStorage.length)].map((_, i) => localStorage.getItem(localStorage.key(i)))), /token=/)
    } finally { app.unmount() }
  })
}
test('changing pages aborts old request; late responses cannot mix items from different queries', async () => {
  let resolveOld, oldSignal, calls = 0
  globalThis.fetch = async (url, options) => {
    calls++
    if (calls === 1) { oldSignal = options.signal; return new Promise(resolve => { resolveOld = () => resolve(Response.json(page([item('obsolete')], 45))) }) }
    return Response.json(page([item('current')], 1))
  }
  const app = mount(Page)
  try {
    await flush(); await model(find(app.root, 'input'), 'new-filter')
    await event(find(app.root, 'form'), 'submit')
    assert.equal(oldSignal.aborted, true)
    resolveOld(); await flush()
    assert.match(text(app.root), /Solicitante current/); assert.doesNotMatch(text(app.root), /obsolete/)
    assert.equal(calls, 2)
  } finally { app.unmount() }
})
test('pagination clears old rows while loading and uses page 2, not mixed pages', async () => {
  let finish
  globalThis.fetch = async url => url.includes('page=2') ? new Promise(resolve => { finish = () => resolve(Response.json(page([item('page-two')], 45, 2))) }) : Response.json(page([item('page-one')], 45))
  const app = mount(Page)
  try {
    await flush(); const next = event(find(app.root, 'button', 'Siguiente'), 'click'); await flush()
    assert.doesNotMatch(text(app.root), /Solicitante page-one/)
    finish(); await next
    assert.match(text(app.root), /Solicitante page-two/); assert.match(text(app.root), /página 2/)
  } finally { app.unmount() }
})
test('PDF signature canceled by refresh, no stale link or error; rejection still works while signing', async () => {
  let finish, signal
  globalThis.fetch = async (url, options) => {
    if (url.includes('/evidence/')) { signal = options.signal; return new Promise(resolve => { finish = () => resolve(Response.json({ url: signed() })) }) }
    if (url.endsWith('/reject')) return Response.json({ ...item(), status: 'RECHAZADA' })
    return Response.json(page([item()]))
  }
  const app = mount(Page)
  try {
    await flush(); const preparing = event(find(app.root, 'button', 'Abrir constancia PDF'), 'click'); await flush()
    await event(find(app.root, 'button', 'Rechazar'), 'click')
    await event(find(app.root, 'dialog').children.find(n => n.tag === 'form') ?? find(find(app.root, 'dialog'), 'form'), 'submit')
    assert.equal(signal.aborted, true)
    finish(); await preparing
    assert.equal(find(app.root, 'a', 'Ver PDF'), undefined)
    assert.equal(find(app.root, 'dialog'), undefined); assert.match(text(app.root), /Rechazo confirmado/)
  } finally { app.unmount() }
})
test('unused signed link is discarded before 15-minute expiry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  globalThis.fetch = async url => Response.json(url.includes('/evidence/') ? { url: signed() } : page([item()]))
  const app = mount(Page)
  try {
    await flush(); await event(find(app.root, 'button', 'Abrir constancia PDF'), 'click')
    assert.ok(find(app.root, 'a', 'Ver PDF'))
    t.mock.timers.tick(15 * 60 * 1000); await flush()
    assert.equal(find(app.root, 'a', 'Ver PDF'), undefined)
  } finally { app.unmount() }
})
test('PDF URLs require HTTPS, signed storage path, registration document and token', async () => {
  for (const url of ['javascript:alert(1)', 'http://project.supabase.co/unsafe', 'https://evil.invalid/file.pdf', signed().replace('/sign/', '/public/'), signed().replace('registration-evidence/', 'another/'), signed().replace('?token=new', ''), signed().replace('https://', 'https://user:pass@')]) {
    globalThis.fetch = async () => Response.json({ url })
    await assert.rejects(users.getRegistrationEvidenceUrl('request', 0), e => e.status === 422)
  }
})
test('form exposes per-field accessible errors before POST, exact domain hint and whitespace password', async () => {
  auth.clearSession(); let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('must not post') }
  const app = mount(Form)
  try {
    await event(find(app.root, 'form'), 'submit')
    for (const key of ['name', 'email', 'password', 'institutionalId', 'phone', 'evidence']) {
      const control = findAll(app.root, n => n.tag === 'input').find(n => (n.props['aria-describedby'] ?? '').split(' ').includes('registration-' + key + '-error'))
      assert.equal(control.props['aria-invalid'], true)
      assert.ok(findAll(app.root, n => n.props.id === 'registration-' + key + '-error' && n.props.role === 'alert').length)
    }
    const inputs = findAll(app.root, n => n.tag === 'input')
    await model(inputs[1], 'user@unsa.edu.pe.evil')
    assert.match(text(app.root), /dominio exacto @unsa.edu.pe/)
    await model(inputs[2], '\u2003'.repeat(8)); await event(find(app.root, 'form'), 'submit')
    assert.match(text(app.root), /no contener solo espacios/); assert.equal(calls, 0)
  } finally { app.unmount() }
})
test('API normalizes email and appropriate fields only; legitimate password with edge spaces stays exact', async () => {
  const input = body(); let calls = 0
  globalThis.fetch = async (_url, options) => {
    calls++; const sent = JSON.parse(options.body)
    assert.equal(sent.email, 'user@unsa.edu.pe'); assert.equal(sent.password, input.password)
    assert.equal(sent.institutionalId, 'DOC-1'); assert.equal(sent.phone, '999123456')
    return Response.json({ id: 'request', status: 'PENDIENTE' })
  }
  await api.requestFullRegistration(input); assert.equal(calls, 1)
  for (const password of ['        ', '\u2003'.repeat(8)]) await assert.rejects(api.requestFullRegistration({ ...input, password }), e => e.status === 400)
  for (const email of ['user@evil.pe', 'user@sub.unsa.edu.pe', 'user@unsa.edu.pe.evil', 'user@@unsa.edu.pe', 'user name@unsa.edu.pe']) {
    assert.equal(policy.isInstitutionalEmail(email), false)
    await assert.rejects(api.requestFullRegistration({ ...input, email }), e => e.status === 400)
  }
  for (const key of ['name', 'institutionalId', 'phone']) for (const value of [undefined, null, '', '   ']) await assert.rejects(api.requestFullRegistration({ ...input, [key]: value }), e => e.status === 400)
  assert.equal(calls, 1); assert.equal(pendingMutation('full-registration'), false)
})
test('JSON 413 remains visible and allows correction, not uncertain resubmission', async () => {
  globalThis.fetch = async () => Response.json({ statusCode: 413, message: 'El cuerpo supera 15 MiB; PDF hasta 10 MiB.' }, { status: 413 })
  await assert.rejects(api.requestFullRegistration(body()), e => e.status === 413 && e.message.includes('15 MiB'))
  assert.equal(pendingMutation('full-registration'), false)
})
test('PDF picker accepts exact 10 MiB, rejects 10 MiB + 1 and keeps image limit at 60 KiB', async () => {
  const bytes = Buffer.alloc(10 * 1024 * 1024, 32)
  bytes.write('%PDF-1.7\n'); bytes.write('\n%%EOF', bytes.length - 6)
  const file = (buffer, type) => ({ type, size: buffer.length, arrayBuffer: async () => Uint8Array.from(buffer).buffer })
  const result = await readRegistrationEvidence(file(bytes, 'application/pdf'))
  assert.equal(result, 'data:application/pdf;base64,' + bytes.toString('base64'))
  await assert.rejects(readRegistrationEvidence(file(Buffer.concat([bytes, Buffer.from(' ')]), 'application/pdf')), /10 MiB/)
  await assert.rejects(readRegistrationEvidence(file(Buffer.alloc(60 * 1024 + 1), 'image/png')), /60 KiB/)
})
test('mounted form normalizes uppercase email but preserves legitimate edge whitespace password for all institutional types', async () => {
  auth.clearSession()
  const previousImage = globalThis.Image
  globalThis.Image = class { naturalWidth = 1; naturalHeight = 1; async decode() {} }
  const terms = { id: body().termsVersionId, number: 1, title: 'Términos', content: 'Contenido completo vigente' }
  try {
    for (const userType of ['ESTUDIANTE', 'DOCENTE', 'ADMINISTRATIVO']) {
      let sent
      globalThis.fetch = async (_url, options) => {
        if (options.method === 'POST') { sent = JSON.parse(options.body); return Response.json({ id: 'new', status: 'PENDIENTE' }) }
        return Response.json(terms)
      }
      const app = mount(Form)
      try {
        const inputs = findAll(app.root, n => n.tag === 'input')
        for (const [index, value] of [[0, 'Nombre completo'], [1, ' USER@UNSA.EDU.PE '], [2, ' legitimate password '], [3, 'DOC-VALID'], [4, '999123456']]) await model(inputs[index], value)
        await model(find(app.root, 'select'), userType)
        const bytes = Buffer.from(png.split(',')[1], 'base64')
        await event(inputs.find(n => n.props.type === 'file'), 'change', { target: { files: [{ type: 'image/png', size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer }] } })
        await event(find(app.root, 'button', 'Consultar términos actuales'), 'click')
        await event(find(app.root, 'button', 'Cerrar documento'), 'click')
        const checkbox = findAll(app.root, n => n.tag === 'input' && n.props.type === 'checkbox')[0]
        await model(checkbox, true); await event(checkbox, 'change')
        await event(find(app.root, 'form'), 'submit')
        assert.equal(sent.email, 'user@unsa.edu.pe'); assert.equal(sent.password, ' legitimate password ')
        assert.equal(sent.userType, userType); assert.equal(sent.institutionalId, 'DOC-VALID')
      } finally { app.unmount() }
    }
  } finally { globalThis.Image = previousImage }
})
test('PDF preparation supports concurrent different records, serializes documents of same record and approval invalidates outstanding signing', async () => {
  const first = item('first'); first.evidence.push({ information: pdf })
  const second = item('second')
  const pending = [], calls = []
  globalThis.fetch = async (url, options) => {
    if (url.includes('/evidence/')) { calls.push(url); return new Promise(resolve => pending.push({ signal: options.signal, finish: () => resolve(Response.json({ url: signed() })) })) }
    if (url.endsWith('/approve')) return Response.json({ request: { ...second, status: 'APROBADA' }, user: { id: 'created-user' } })
    return Response.json(page([first, second]))
  }
  const app = mount(Page)
  try {
    await flush()
    const buttons = findAll(app.root, n => n.tag === 'button' && text(n).includes('constancia PDF'))
    const a = event(buttons[0], 'click'); await flush()
    await event(buttons[1], 'click'); assert.equal(calls.length, 1)
    const b = event(buttons[2], 'click'); await flush(); assert.equal(calls.length, 2)
    await event(findAll(app.root, n => n.tag === 'button' && text(n).includes('Aprobar vinculación'))[1], 'click')
    await event(find(find(app.root, 'dialog'), 'form'), 'submit')
    assert.ok(pending.every(p => p.signal.aborted))
    for (const p of pending) p.finish()
    await Promise.all([a, b]); await flush()
    assert.equal(find(app.root, 'a', 'Ver PDF'), undefined); assert.match(text(app.root), /Solicitud aprobada/)
  } finally { app.unmount() }
})
