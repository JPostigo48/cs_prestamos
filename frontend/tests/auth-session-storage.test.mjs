import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { load, memoryStorage, session, testEnvironment } from './helpers/modules.mjs'

const auth = await load('modules/auth/api/auth-api')
const client = await load('shared/api/client')
const policy = await load('modules/auth/access-policy')
const key = 'cs-prestamos-session'
const marker = 'cs-prestamos-session-migrated'
beforeEach(testEnvironment)

// Dos contextos con almacenamiento por pestaña independiente y origen compartido.
function browserTabs() {
  const shared = memoryStorage()
  const tabs = [0, 1].map(() => ({ legacy: memoryStorage(), events: new EventTarget() }))
  function activate(index) {
    globalThis.localStorage = shared
    globalThis.sessionStorage = tabs[index].legacy
    globalThis.window = tabs[index].events
  }
  function storage(index, changedKey = key, area = shared) {
    activate(index)
    const event = new Event('storage')
    Object.assign(event, { key: changedKey, storageArea: area })
    tabs[index].events.dispatchEvent(event)
  }
  activate(0)
  return { shared, tabs, activate, storage }
}

test('persiste A → B, recarga y reapertura sin renovar la caducidad', () => {
  const browser = browserTabs()
  const original = session()
  auth.saveSession(original)
  browser.activate(1)
  assert.deepEqual(auth.getSession(), original)
  // Nuevo contexto sin almacenamiento de pestaña (también tras cerrar el navegador).
  globalThis.sessionStorage = memoryStorage()
  globalThis.window = new EventTarget()
  assert.deepEqual(auth.getSession(), original)
  assert.equal(JSON.parse(browser.shared.getItem(key)).expiresAt, original.expiresAt)
})

test('rechaza y elimina JSON, token, vencimiento, rol y tipo inválidos sin fallback legado', () => {
  const browser = browserTabs()
  const valid = session()
  for (const invalid of [
    '{', 'null', '', JSON.stringify({ ...valid, accessToken: '' }),
    JSON.stringify({ ...valid, accessToken: 12 }),
    JSON.stringify({ ...valid, tokenType: 'Basic' }),
    JSON.stringify({ ...valid, expiresAt: Date.now() - 1 }),
    JSON.stringify({ ...valid, expiresAt: 'future' }),
    JSON.stringify({ ...valid, user: { ...valid.user, role: 'DOCENTE' } }),
    JSON.stringify({ ...valid, user: { ...valid.user, userType: 'OPERADOR' } }),
  ]) {
    browser.tabs[0].legacy.setItem(key, JSON.stringify(valid))
    browser.shared.setItem(key, invalid)
    assert.equal(auth.getSession(), null)
    assert.equal(browser.shared.getItem(key), null)
    assert.equal(browser.tabs[0].legacy.getItem(key), null)
  }
})

test('sesión compartida prevalece; migración única conserva TTL y retira legado', () => {
  const browser = browserTabs()
  browser.activate(1)
  assert.equal(auth.getSession(), null) // Sin legado no bloquea la migración de A.
  browser.activate(0)
  const legacy = session('ADMINISTRADOR')
  browser.tabs[0].legacy.setItem(key, JSON.stringify(legacy))
  assert.deepEqual(auth.getSession(), legacy)
  assert.equal(browser.tabs[0].legacy.getItem(key), null)
  assert.equal(JSON.parse(browser.shared.getItem(key)).expiresAt, legacy.expiresAt)
  const current = { ...session(), accessToken: 'another-offline-token' }
  auth.saveSession(current)
  browser.activate(1)
  browser.tabs[1].legacy.setItem(key, JSON.stringify(legacy))
  assert.deepEqual(auth.getSession(), current)
  assert.equal(browser.tabs[1].legacy.getItem(key), null)
})

test('legado inválido se elimina, no se migra ni se reutiliza posteriormente', () => {
  const browser = browserTabs()
  browser.tabs[0].legacy.setItem(key, '{')
  assert.equal(auth.getSession(), null)
  assert.equal(browser.tabs[0].legacy.getItem(key), null)
  assert.equal(browser.shared.getItem(key), null)
  browser.tabs[1].legacy.setItem(key, JSON.stringify(session()))
  browser.activate(1)
  assert.equal(auth.getSession(), null)
})

test('logout evita resurrección incluso en pestaña inactiva que no recibió eventos', () => {
  const browser = browserTabs()
  const original = session()
  auth.saveSession(original)
  browser.tabs[1].legacy.setItem(key, JSON.stringify(original))
  auth.clearSession()
  browser.activate(1)
  assert.equal(auth.getSession(), null)
  assert.equal(browser.tabs[1].legacy.getItem(key), null)
  assert.equal(browser.shared.getItem(marker), '1')
})

test('eventos: sincroniza login/logout/clear, ignora otras claves y sessionStorage; permite cleanup', () => {
  const browser = browserTabs()
  const original = session()
  browser.activate(1)
  const changes = []
  const unsubscribe = auth.subscribeSessionChanges(value => changes.push(value))
  browser.activate(0)
  auth.saveSession(original)
  browser.storage(1, 'pending-return')
  browser.storage(1, key, browser.tabs[1].legacy)
  browser.storage(1, null, browser.tabs[1].legacy)
  assert.equal(changes.length, 0)
  browser.storage(1)
  assert.deepEqual(changes, [original])
  browser.activate(0)
  auth.clearSession()
  browser.storage(1)
  assert.deepEqual(changes, [original, null])
  browser.tabs[1].legacy.setItem(key, JSON.stringify(original))
  browser.shared.clear()
  browser.storage(1, null)
  assert.equal(changes.at(-1), null)
  assert.equal(browser.tabs[1].legacy.getItem(key), null)
  assert.equal(browser.shared.getItem(marker), '1')
  unsubscribe()
  browser.storage(1)
  assert.equal(changes.length, 3)
})

test('almacenamiento bloqueado o sin cuota falla de forma controlada, sin sesión ficticia', () => {
  const original = session()
  for (const name of ['SecurityError', 'QuotaExceededError']) {
    testEnvironment()
    const storage = memoryStorage()
    globalThis.localStorage = {
      ...storage,
      setItem() { throw new DOMException('Simulated storage failure', name) },
    }
    assert.throws(() => auth.saveSession(original), error => error.status === 0 && /No se pudo guardar la sesión compartida/.test(error.message))
    assert.equal(storage.getItem(key), null)
    assert.equal(auth.getSession(), null)
    assert.doesNotThrow(() => auth.clearSession())
  }
  const storage = memoryStorage()
  globalThis.localStorage = {
    ...storage,
    setItem(changedKey, value) {
      if (changedKey === key) throw new DOMException('Simulated full quota', 'QuotaExceededError')
      storage.setItem(changedKey, value)
    },
  }
  sessionStorage.setItem(key, JSON.stringify(original))
  assert.equal(auth.getSession(), null) // Migración fallida no aparenta persistir.
  assert.equal(sessionStorage.getItem(key), null)
  assert.equal(storage.getItem(key), null)
  assert.throws(() => auth.saveSession(original), /No se pudo guardar/)
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('Simulated blocked storage', 'SecurityError') },
  })
  assert.throws(() => auth.saveSession(original), /No se pudo guardar/)
  assert.equal(auth.getSession(), null)
  assert.doesNotThrow(() => auth.clearSession())
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: memoryStorage() })
})

// Ejecuta los hooks del router real; solo sustituye Vue Router y los componentes
// visuales, que requieren DOM. No duplica la lógica de sincronización o guards.
async function routerHarness() {
  const source = await readFile(new URL('../src/router.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source.replace(/^import .* from .*$/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace('export const router', 'const router')
  const hooks = {}
  const replacements = []
  let reloads = 0
  window.location = { reload() { reloads++ } }
  const router = {
    currentRoute: { value: { path: '/app/admin/users', fullPath: '/app/admin/users?filter=x', meta: { authenticated: true } } },
    beforeEach(callback) { hooks.guard = callback },
    afterEach(callback) { hooks.after = callback },
    replace(destination) { replacements.push(destination); return Promise.resolve() },
  }
  const dependencies = {
    createRouter: () => router, createWebHistory: () => ({}),
    LoginPage: {}, RegistrationRequestPage: {}, StudentAppPage: {}, AppLayout: {},
    AccessDeniedPage: {}, ApplicationPrototypePage: {}, projectRoutes: [],
    getSession: auth.getSession, clearSession: auth.clearSession,
    subscribeSessionChanges: auth.subscribeSessionChanges,
    onUnauthorized: client.onUnauthorized,
    canAccess: policy.canAccess, safeDestination: policy.safeDestination,
  }
  new Function(...Object.keys(dependencies), code)(...Object.values(dependencies))
  return { router, hooks, replacements, reloads: () => reloads }
}

test('router: cambio de cuenta/token reconstruye UI protegida, conserva permisos y no recarga showcase', async () => {
  const browser = browserTabs()
  auth.saveSession(session('ADMINISTRADOR'))
  browser.activate(1)
  const harness = await routerHarness()
  browser.activate(0)
  const next = { ...session(), accessToken: 'second-offline-token', user: { ...session().user, id: 'other-user', email: 'other@example.invalid' } }
  auth.saveSession(next)
  harness.hooks.after(harness.router.currentRoute.value, harness.router.currentRoute.value)
  browser.storage(1)
  assert.equal(harness.reloads(), 1)
  assert.equal(harness.hooks.guard(harness.router.currentRoute.value), '/app/denied')
  browser.storage(1) // Mismo estado: sin bucle de recarga.
  assert.equal(harness.reloads(), 1)
  harness.router.currentRoute.value = { path: '/project', fullPath: '/project', meta: {} }
  harness.hooks.after(harness.router.currentRoute.value, { meta: {} })
  browser.activate(0)
  auth.saveSession(session('OPERADOR'))
  browser.storage(1)
  assert.equal(harness.reloads(), 1)
  assert.equal(harness.replacements.length, 0)
})

test('router: logout remoto redirige y 401 obsoleto se ignora, 401 actual cierra sesión compartida', async () => {
  const browser = browserTabs()
  const original = session('ADMINISTRADOR')
  auth.saveSession(original)
  browser.activate(1)
  const harness = await routerHarness()
  globalThis.fetch = async () => Response.json({ message: 'Unauthorized' }, { status: 401 })
  await assert.rejects(client.apiRequest('/offline', { token: 'obsolete-offline-token' }), error => error.status === 401)
  assert.deepEqual(auth.getSession(), original)
  assert.equal(harness.replacements.length, 0)
  await assert.rejects(client.apiRequest('/offline', { token: original.accessToken }), error => error.status === 401)
  assert.equal(browser.shared.getItem(key), null)
  assert.deepEqual(harness.replacements[0], { path: '/login', query: { redirect: '/app/admin/users?filter=x' } })
  auth.saveSession(original)
  harness.hooks.after(harness.router.currentRoute.value, { meta: {} })
  browser.activate(0)
  auth.clearSession()
  browser.storage(1)
  assert.equal(harness.replacements.length, 2)
  assert.equal(harness.reloads(), 0)
  assert.deepEqual(harness.hooks.guard(harness.router.currentRoute.value), harness.replacements[1])
})
