import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { effectScope, nextTick, ref } from 'vue'

// Usa el compilador ya instalado y el runner de Node: sin instalar ni generar archivos.
const modules = new Map()
async function moduleUrl(path) {
  const url = new URL(path, import.meta.url)
  if (modules.has(url.href)) return modules.get(url.href)
  const source = await readFile(url, 'utf8')
  let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  code = code.replaceAll('import.meta.env', '({})')
  for (const match of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]) {
    const dependency = match[1].startsWith('.')
      ? await moduleUrl(new URL(match[1] + '.ts', url).href) : import.meta.resolve(match[1])
    code = code.replace(match[0], 'from ' + JSON.stringify(dependency))
  }
  const result = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  modules.set(url.href, result)
  return result
}
const load = async path => import(await moduleUrl('../src/' + path + '.ts'))
const policy = await load('modules/auth/access-policy')
const query = await load('modules/inventory/catalog-query')
const returns = await load('modules/loans/return-policy')
const appeals = await load('modules/users/appeal-policy')
const auth = await load('modules/auth/api/auth-api')
const client = await load('shared/api/client')
const inventory = await load('modules/inventory/api/inventory-api')
const loans = await load('modules/loans/api/loans-api')
const student = await load('modules/users/api/student-api')
const { useRemote } = await load('shared/composables/useRemote')
const values = new Map()
globalThis.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
globalThis.window = new EventTarget()
const session = (role = 'USUARIO') => ({ accessToken: 'test-token', tokenType: 'Bearer', expiresAt: Date.now() + 60000, user: { id: 'u1', email: 'test@example.invalid', role, userType: 'DOCENTE' } })

test('política: tres roles, rutas directas y destinos seguros', () => {
  for (const role of ['USUARIO', 'OPERADOR', 'ADMINISTRADOR']) {
    assert.equal(policy.canAccess('/app/catalog', role), true)
    assert.equal(policy.canAccess('/app/catalog/resource-id', role), true)
    assert.equal(policy.canAccess('/app/loans', role), role !== 'USUARIO')
    assert.equal(policy.homeFor(role), role === 'ADMINISTRADOR' ? '/app/admin/appeals' : role === 'USUARIO' ? '/app' : '/app/loans')
    assert.equal(policy.canAccess('/app/admin/appeals', role), role === 'ADMINISTRADOR')
    assert.equal(policy.canAccess('/app/admin/users', role), role === 'ADMINISTRADOR')
    assert.equal(policy.canAccess('/app/admin/catalog', role), role === 'ADMINISTRADOR')
    assert.equal(policy.canAccess('/app/registrations', role), role !== 'USUARIO')
    assert.equal(policy.canAccess('/app/reservations', role), true)
    for (const unsafe of ['https://evil.invalid', '//evil.invalid', '/app/../login', '/app/denied', '/login', '/app\\evil', ['/app'], '/app/unknown']) {
      assert.equal(policy.safeDestination(unsafe, role), policy.homeFor(role))
    }
  }
  assert.equal(policy.safeDestination('/app/loans', 'USUARIO'), '/app')
  assert.equal(policy.safeDestination('/app/catalog/r1?page=2', 'USUARIO'), '/app/catalog/r1?page=2')
})
test('sesión: rechaza JSON inválido, expiración y rol/tipo institucional incorrectos', () => {
  for (const invalid of ['{', 'null', JSON.stringify({ ...session(), expiresAt: 1 }), JSON.stringify(session('DOCENTE')), JSON.stringify({ ...session(), user: { ...session().user, userType: 'OPERADOR' } })]) {
    values.set('cs-prestamos-session', invalid)
    assert.equal(auth.getSession(), null)
    assert.equal(values.has('cs-prestamos-session'), false)
  }
  auth.saveSession(session('OPERADOR'))
  assert.equal(auth.getSession().user.role, 'OPERADOR')
})
test('catálogo: parámetros URL, límites y disponibilidad independientes', async () => {
  const filters = query.catalogFilters({ page: '-1', limit: '101', search: 'x'.repeat(130), available: 'invalid' })
  assert.equal(filters.page, 1); assert.equal(filters.limit, 20); assert.equal(filters.search.length, 120); assert.equal(filters.available, '')
  globalThis.fetch = async (url) => {
    const params = new URL(url, 'https://local.invalid').searchParams
    assert.equal(params.get('page'), '3'); assert.equal(params.get('limit'), '10')
    assert.equal(params.get('available'), 'false'); assert.equal(params.get('categoryId'), 'c1')
    assert.equal(params.get('search'), 'cámara & audio')
    return Response.json({ data: [], total: 24, page: 3, limit: 10 })
  }
  const page = await inventory.getResources(query.catalogFilters({ page: '3', limit: '10', available: 'false', categoryId: 'c1', search: 'cámara & audio' }))
  assert.equal(page.total, 24)
  assert.equal(inventory.durationLabel({ tiempoMaximoPrestamoDias: 0.5, tiempoMaximoPrestamoHoras: 12 }), '12 horas')
  assert.equal(inventory.durationLabel({ tiempoMaximoPrestamoDias: 2, tiempoMaximoPrestamoHoras: 48 }), '2 días')
})
test('devolución: sin incidencia omite observación; incidencia requiere descripción válida', () => {
  const start = '2026-01-01T00:00:00Z', date = '2026-01-02T12:00'
  const now = new Date(date).getTime()
  assert.deepEqual(Object.keys(returns.returnInput(date, false, 'Sin daños', start, now)), ['returnedAt'])
  assert.equal(returns.returnInput(date, true, '  pantalla dañada  ', start, now).observation, 'pantalla dañada')
  for (const run of [() => returns.returnInput('', false, '', start, now), () => returns.returnInput('invalid', false, '', start, now), () => returns.returnInput('2025-01-01', false, '', start, now), () => returns.returnInput(date, true, ' ', start, now), () => returns.returnInput(date, true, 'x'.repeat(1001), start, now)]) assert.throws(run)
  for (const status of [undefined, 0, 500, 503]) assert.equal(returns.uncertainReturn(status), true)
  for (const status of [400, 401, 403, 404, 409]) assert.equal(returns.uncertainReturn(status), false)
})
test('devolución: reloj en el mismo minuto conserva el instante completo sin adelantarlo', () => {
  const start = new Date(2026, 9, 28, 10, 15, 40)
  for (const milliseconds of [0, 123, 999]) {
    const now = new Date(2026, 9, 28, 10, 15, 50, milliseconds)
    const local = returns.localDateTime(now)
    assert.match(local, /^2026-10-28T10:15:50\.\d{3}$/)
    assert.equal(new Date(local).getTime(), now.getTime())
    assert.equal(returns.returnInput(local, false, '', start.toISOString(), now.getTime()).returnedAt, now.toISOString())
  }
  assert.throws(() => returns.returnInput(returns.localDateTime(new Date(start.getTime() - 1)), false, '', start.toISOString()))
})
test('apelación: política visible permite programadas, activas y finalizadas dentro del plazo inclusivo', () => {
  const now = Date.parse('2026-10-28T15:15:50.123Z')
  const day = 24 * 60 * 60 * 1000
  const sanction = { id: 's1', status: 'ACTIVA', startsAt: new Date(now - day).toISOString(), endsAt: null, previousTrust: 100, resultingTrust: 95, ruleId: 'r1', violationId: 'v1' }
  for (const status of ['PROGRAMADA', 'ACTIVA']) {
    assert.equal(appeals.canAppeal({ ...sanction, status }, now), true)
    assert.equal(appeals.canAppeal({ ...sanction, status, endsAt: new Date(now + day).toISOString() }, now), true)
  }
  for (const status of ['PROGRAMADA', 'ACTIVA', 'FINALIZADA']) {
    const endsAt = new Date(now - 30 * day).toISOString()
    assert.equal(appeals.canAppeal({ ...sanction, status, endsAt }, now), true)
    assert.equal(appeals.canAppeal({ ...sanction, status, endsAt }, now + 1), false)
    assert.equal(appeals.canAppeal({ ...sanction, status, endsAt: new Date(now - day).toISOString() }, now), true)
    assert.equal(appeals.canAppeal({ ...sanction, status, violationId: null }, now), false)
  }
  // Sin suspensión: FINALIZADA sin fin usa el instante de registro/inicio.
  const noSuspension = { ...sanction, status: 'FINALIZADA', startsAt: new Date(now - 30 * day).toISOString() }
  assert.equal(appeals.canAppeal(noSuspension, now), true)
  assert.equal(appeals.canAppeal(noSuspension, now + 1), false)
  assert.equal(appeals.canAppeal({ ...sanction, status: 'ABSUELTA' }, now), false)
})
test('transporte: 401 notifica, 403 preserva sesión, errores y red sin reintentos', async () => {
  auth.saveSession(session())
  let notifications = 0, calls = 0
  client.onUnauthorized(token => { assert.equal(token, 'test-token'); notifications++ })
  for (const status of [400, 401, 403, 404, 409, 500]) {
    globalThis.fetch = async () => { calls++; return Response.json({ message: ['Error de contrato'] }, { status }) }
    await assert.rejects(auth.authenticatedRequest('/test', { method: 'POST' }), error => error.status === status)
    assert.ok(auth.getSession())
  }
  assert.equal(notifications, 1); assert.equal(calls, 6)
  globalThis.fetch = async () => { calls++; throw new TypeError('offline') }
  await assert.rejects(auth.authenticatedRequest('/test'), error => error.status === 0)
  assert.equal(calls, 7)
  auth.clearSession()
  let expired = false
  window.addEventListener('session-expired', () => { expired = true }, { once: true })
  await assert.rejects(auth.authenticatedRequest('/test'), error => error.status === 401)
  assert.equal(expired, true); assert.equal(calls, 7)
})
test('contrato de devolución: endpoint, payload, bloqueo persistente y confirmación válida', async () => {
  auth.saveSession(session('OPERADOR'))
  loans.setPendingReturn('l1', true)
  assert.equal(loans.hasPendingReturn('l1'), true)
  const body = returns.returnInput('2026-01-02T12:00', false, '', '2026-01-01', new Date('2026-01-02T12:00').getTime())
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/loans/l1/return'); assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.equal('observation' in JSON.parse(options.body), false)
    return Response.json({ id: 'l1', status: 'FINALIZADO', return: { returnedAt: body.returnedAt } })
  }
  assert.equal((await loans.returnLoan('l1', body)).status, 'FINALIZADO')
  loans.setPendingReturn('l1', false)
  assert.equal(loans.hasPendingReturn('l1'), false)
  for (const response of [null, { id: 'l1', status: 'ACTIVO', return: null }]) {
    globalThis.fetch = async () => Response.json(response)
    await assert.rejects(loans.returnLoan('l1', body), error => error.status === 0)
  }
})
test('panel: peticiones independientes conservan apelación y no descargan el catálogo', async () => {
  auth.saveSession(session())
  const paths = []
  globalThis.fetch = async (url, options) => {
    paths.push(url)
    if (url.endsWith('/trust')) return Response.json({ message: 'Temporal' }, { status: 500 })
    if (url.includes('/appeals')) { assert.deepEqual(JSON.parse(options.body), { reason: 'Revisar mi sanción' }); return Response.json({ id: 'a1', status: 'PENDIENTE', userId: session().user.id, sanctionId: 's1' }) }
    return Response.json(url.includes('history') ? [] : { id: 'u1', name: 'Nombre de prueba' })
  }
  const results = await Promise.allSettled([student.getUser('u1'), student.getTrust('u1'), student.getHistory('u1')])
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected', 'fulfilled'])
  await student.submitAppeal('s1', 'Revisar mi sanción')
  assert.ok(paths.includes('/api/sanctions/s1/appeals'))
  assert.equal(paths.some(path => path.includes('inventory/resources')), false)
})
test('cargas reactivas: aborta consultas anteriores y descarta respuestas fuera de orden', async () => {
  const scope = effectScope()
  const source = ref('primera')
  const requests = []
  let remote
  scope.run(() => {
    remote = useRemote(signal => new Promise(resolve => requests.push({ signal, resolve })), source)
  })
  assert.equal(remote.loading.value, true)
  source.value = 'segunda'
  await nextTick()
  assert.equal(requests[0].signal.aborted, true)
  requests[1].resolve('nueva')
  await nextTick()
  assert.equal(remote.data.value, 'nueva')
  requests[0].resolve('obsoleta')
  await nextTick()
  assert.equal(remote.data.value, 'nueva')
  source.value = 'tercera'
  await nextTick()
  assert.equal(remote.data.value, null)
  scope.stop()
  assert.equal(requests[2].signal.aborted, true)
  requests[2].resolve('desmontada')
  await nextTick()
  assert.equal(remote.data.value, null)
})
test('cargas independientes: fallo local, código HTTP y reintento recuperable', async () => {
  const scope = effectScope()
  let broken, healthy, fail = true
  scope.run(() => {
    broken = useRemote(async () => { if (fail) throw new client.ApiError('Temporal', 503); return ['recuperado'] })
    healthy = useRemote(async () => ['disponible'])
  })
  await nextTick()
  assert.equal(broken.status.value, 503)
  assert.equal(broken.data.value, null)
  assert.deepEqual(healthy.data.value, ['disponible'])
  fail = false
  await broken.refresh()
  assert.equal(broken.error.value, '')
  assert.deepEqual(broken.data.value, ['recuperado'])
  scope.stop()
})
