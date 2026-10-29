// Comprobación local explícita: bundle real + API de prueba interceptada por CDP.
// Nunca inicia backend, carga entorno, consulta DB ni permite tráfico externo.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { resolve, dirname, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { appeal, sanction, userId } from '../tests/helpers/trust-fixtures.mjs'

const front = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(front, '../../IA/evidencia-fase3-cierre-2026-10-29')
const dist = resolve(front, 'dist')
const profile = resolve(out, 'chrome-profile')
const origin = 'http://127.0.0.1:4187'
const api = JSON.parse(readFileSync(resolve(dist, 'generated/project/openapi.json'), 'utf8'))
assert.deepEqual(api, JSON.parse(readFileSync(resolve(front, '../backend/openapi.json'), 'utf8')))
mkdirSync(out, { recursive: true })
const result = { nature: 'Chrome real, bundle estático; API MOCK SOLO PRUEBA, sin PostgreSQL ni Google externo', cases: [], requests: [], errors: [], blocked: [] }
const affectedOnly = process.argv.includes('--only-failed')
const previous = affectedOnly ? JSON.parse(readFileSync(resolve(out, 'browser-resultados.json'), 'utf8')) : null
const sleep = ms => new Promise(done => setTimeout(done, ms))
let server, chrome, browser, page, sessionScript
class CDP {
  constructor(url) {
    this.socket = new WebSocket(url); this.id = 0; this.pending = new Map(); this.handlers = new Map()
    this.ready = new Promise((done, fail) => { this.socket.onopen = done; this.socket.onerror = fail })
    this.socket.onmessage = event => {
      const value = JSON.parse(event.data)
      if (value.id) {
        const pending = this.pending.get(value.id)
        if (!pending) return
        clearTimeout(pending.timer); this.pending.delete(value.id)
        if (value.error) pending.fail(Error(JSON.stringify(value.error))); else pending.done(value.result)
      } else for (const handler of this.handlers.get(value.method) ?? []) Promise.resolve(handler(value.params)).catch(error => result.errors.push(String(error)))
    }
  }
  async send(method, params = {}) {
    await this.ready
    const id = ++this.id
    return new Promise((done, fail) => {
      const timer = setTimeout(() => { this.pending.delete(id); fail(Error('CDP timeout: ' + method)) }, 15000)
      this.pending.set(id, { done, fail, timer }); this.socket.send(JSON.stringify({ id, method, params }))
    })
  }
  on(method, handler) { this.handlers.set(method, [...this.handlers.get(method) ?? [], handler]) }
  close() { this.socket.close() }
}
async function evaluate(expression) {
  const response = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
  return response.result.value
}
async function wait(expression) {
  const started = Date.now()
  while (Date.now() - started < 10000) { if (await evaluate(expression)) return; await sleep(80) }
  throw Error('No se cumplió: ' + expression)
}
async function navigate(path) {
  await page.send('Page.navigate', { url: origin + path })
  await wait("document.readyState === 'complete' && !!document.querySelector('#app')?.children.length")
  await sleep(180)
}
async function fill(selector, value) {
  await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw Error('Sin campo'); e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true})); })()`)
  await sleep(100)
}
async function button(label) {
  await evaluate(`(() => { const e = [...document.querySelectorAll('button')].find(e => e.getClientRects().length && e.textContent.trim() === ${JSON.stringify(label)}); if (!e) throw Error('Sin botón: '+${JSON.stringify(label)}); e.click() })()`)
  await sleep(130)
}
async function shot(name) {
  const capture = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(resolve(out, name + '.png'), Buffer.from(capture.data, 'base64'))
}
async function test(name, run) {
  if (previous?.cases.some(item => item.name === name && item.pass)) return
  try { const detail = await run(); result.cases.push({ name, pass: true, detail }); console.log('PASS', name) }
  catch (error) { result.cases.push({ name, pass: false, error: String(error) }); console.error('FAIL', name, String(error)) }
}
async function session(role) {
  if (sessionScript) await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: sessionScript })
  const value = { accessToken: 'TEST-NOT-A-REAL-JWT', tokenType: 'Bearer', expiresAt: Date.now() + 3600000, user: { id: userId, email: 'test@example.invalid', role, userType: 'ESTUDIANTE' } }
  sessionScript = (await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem('cs-prestamos-session', ${JSON.stringify(JSON.stringify(value))})` })).identifier
}
const category = { id: 'category-test', nombre: 'Equipos de prueba', resourceCount: 1, tiempoMaximoPrestamoDias: 2, tiempoMaximoPrestamoHoras: 48 }
const resource = { id: 'resource-test', categoriaId: category.id, categoria: category, nombre: 'Proyector de prueba', descripcion: 'Fixture exclusivamente de validación.', availableCopies: 1, totalCopies: 1, loanPolicy: { categoryDurationHours: 48, individualDurationHours: null, effectiveDurationHours: 48, source: 'CATEGORY' } }
const copy = { id: 'copy-test', recursoId: resource.id, codigoInventario: 'TEST-001', estado: 'DISPONIBLE', recurso: { id: resource.id, nombre: resource.nombre, categoriaId: category.id } }
const terms = { id: 'terms-test', number: 42, title: 'Términos de prueba CDP', content: '## Aceptación\nContenido remoto de prueba, no términos productivos.', publishedAt: '2026-10-29T00:00:00Z', policiesStatus: 'COMPLETE', policies: [] }
const reservation = { id: 'reservation-test', userId, copyId: copy.id, requestedAt: '2026-10-30T12:00:00Z', pickupDeadline: '2026-10-30T13:00:00Z', loanDurationHours: 48, status: 'CONFIRMADA', pickedUpAt: null, cancelledAt: null, cancellationReason: null, loanId: null, configurationSnapshot: null }
function fixture(path, method) {
  if (path === '/terms/current') return [200, terms]
  if (path === '/auth/google/authorization' && method === 'POST') return [503, { message: 'Google no configurado (fixture)' }]
  if (path === '/inventory/resources/resource-test') return [200, resource]
  if (path === '/inventory/resources/resource-test/accessories') return [200, { resourceId: resource.id, items: [{ id: 'part-test', nombre: 'Cable de prueba' }] }]
  if (path === '/inventory/resources/resource-test/copies') return [200, [copy]]
  if (path === '/inventory/copies/copy-test') return [200, copy]
  if (path === '/loans/resource/resource-test/history') return [200, { items: [], total: 0, page: 1, limit: 20 }]
  if (path === '/loans/reservations' && method === 'GET') return [200, { items: [reservation], total: 1, page: 1, limit: 20 }]
  if (path === '/appeals') return [200, { items: [appeal()], total: 1, page: 1, limit: 20 }]
  if (path === '/sanctions/sanction-real') return [200, sanction()]
  if (path === '/users/' + userId) return [200, { id: userId, name: 'Persona de prueba', userType: 'ESTUDIANTE', institutionalId: 'TEST', hasCurrentAffiliation: true, trustPercentage: 70 }]
  throw Error('Petición sin fixture explícito: ' + method + ' ' + path)
}
try {
  server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, origin).pathname)
    if (request.method !== 'GET' || pathname.includes('/.') || pathname.startsWith('/api/')) { response.writeHead(403).end(); return }
    const file = resolve(dist, '.' + pathname)
    if (!file.startsWith(dist + sep)) { response.writeHead(403).end(); return }
    const target = extname(pathname) ? file : resolve(dist, 'index.html')
    if (!existsSync(target)) { response.writeHead(404).end(); return }
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(target)] ?? 'application/octet-stream')
    response.end(readFileSync(target))
  })
  await new Promise((done, fail) => { server.once('error', fail); server.listen(4187, '127.0.0.1', done) })
  chrome = spawn('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9347', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--disable-default-apps', '--no-pings', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=127.0.0.1;localhost', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost', 'about:blank'], { stdio: 'ignore' })
  let info
  for (let i = 0; i < 100; i++) { try { info = await (await fetch('http://127.0.0.1:9347/json/version')).json(); break } catch { await sleep(100) } }
  assert.ok(info, 'Chrome CDP no disponible'); result.browser = info.Browser
  browser = new CDP(info.webSocketDebuggerUrl)
  const targets = await (await fetch('http://127.0.0.1:9347/json/list')).json()
  page = new CDP(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  page.on('Runtime.exceptionThrown', value => result.errors.push(value.exceptionDetails.exception?.description ?? value.exceptionDetails.text))
  page.on('Fetch.requestPaused', async value => {
    const url = new URL(value.request.url)
    if (url.origin !== origin || url.pathname.includes('/.')) {
      result.blocked.push(url.href); await page.send('Fetch.failRequest', { requestId: value.requestId, errorReason: 'BlockedByClient' }); return
    }
    if (!url.pathname.startsWith('/api/')) { await page.send('Fetch.continueRequest', { requestId: value.requestId }); return }
    let status, body
    try { [status, body] = fixture(url.pathname.slice(4), value.request.method) }
    catch (error) { result.errors.push(String(error)); status = 599; body = { message: 'Fixture no declarado' } }
    result.requests.push({ method: value.request.method, path: url.pathname + url.search, status })
    await page.send('Fetch.fulfillRequest', { requestId: value.requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') })
  })
  await page.send('Page.enable'); await page.send('Runtime.enable')
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await navigate('/project/api')
  await wait("document.body.innerText.includes('75 endpoints')")
  const routes = [
    ['post', '/auth/google/authorization'], ['post', '/auth/google/authenticate'], ['get', '/terms/current'], ['post', '/auth/registration-requests'], ['get', '/auth/accounts'],
    ['get', '/inventory/resources/{resourceId}/accessories'], ['put', '/inventory/resources/{resourceId}/accessories'], ['patch', '/inventory/resources/{resourceId}/loan-policy'],
    ['get', '/loans/resource/{resourceId}/history'], ['post', '/loans/{loanId}/return-checklist'], ['get', '/loans/reservations'], ['get', '/appeals'], ['get', '/sanctions/{sanctionId}'], ['post', '/users/{userId}/suspensions'], ['post', '/sanctions/{sanctionId}/lift'],
  ]
  for (const [method, path] of routes) await test(method.toUpperCase() + ' ' + path, async () => {
    await fill('input', method.toUpperCase() + ' ' + path)
    await evaluate(`(() => {const e = [...document.querySelectorAll('details')].find(e => e.querySelector('summary > code')?.textContent === ${JSON.stringify(path)} && e.querySelector('summary > span')?.textContent === ${JSON.stringify(method.toUpperCase())}); if (!e) throw Error('Operación no visible'); e.dataset.check = 'endpoint'; e.open = true; e.scrollIntoView({block:'start'});})()`)
    const operation = api.paths[path][method]
    const publicRoute = !operation['x-authentication'].required
    const content = await evaluate(`(() => { const e = document.querySelector('[data-check="endpoint"]'); return {text:e.textContent,lock:!!e.querySelector('.access-trigger'),schemas:[...e.querySelectorAll('details')].map(d=>d.textContent)} })()`)
    assert.equal(content.lock, !publicRoute)
    assert.ok(content.schemas.length > 0)
    assert.ok(content.schemas.some(schema => schema.includes('properties')))
    assert.doesNotMatch(content.text, /La forma de la respuesta aún no está documentada|Este medio no declara un esquema/)
    let tooltip = null
    if (!publicRoute) {
      await page.send('Page.bringToFront')
      await evaluate(`document.querySelector('[data-check="endpoint"] .access-trigger').scrollIntoView({block:'center',behavior:'instant'})`)
      await sleep(250)
      const point = await evaluate(`(() => {const r = document.querySelector('[data-check="endpoint"] .access-trigger').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 })
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point })
      await wait("!!document.querySelector('[role=tooltip]')")
      tooltip = await evaluate("document.querySelector('[role=tooltip]').textContent")
      for (const role of operation['x-roles']) assert.ok(tooltip.includes(role))
      if (operation['x-access-constraints']) assert.ok(tooltip.includes(operation['x-access-constraints']))
    }
    if (path === '/auth/google/authorization') await shot('api-google-publica')
    if (path === '/sanctions/{sanctionId}') await shot('api-trust-propiedad')
    if (path === '/users/{userId}/suspensions') await shot('api-admin')
    await evaluate(`document.querySelector('[data-check="endpoint"]').removeAttribute('data-check')`)
    return { publicRoute, roles: operation['x-roles'], tooltip, responseSchemas: content.schemas.length }
  })
  await test('DB Showcase conserva modelos y búsqueda', async () => {
    await navigate('/project/db'); await wait("document.querySelectorAll('h3').length > 20")
    const count = await evaluate("document.querySelectorAll('h3').length")
    assert.ok(count >= 31); await fill('input', 'Cuenta')
    const filtered = await evaluate("document.querySelectorAll('h3').length")
    assert.ok(filtered > 0 && filtered < count); await shot('showcase-db')
    return { modelsAndEnumsVisible: count }
  })
  await test('T&C Showcase conserva consulta pública', async () => {
    await navigate('/project/terms'); await wait("document.body.innerText.includes('Versión 42')")
    assert.ok(await evaluate("document.body.innerText.includes('Términos de prueba CDP')")); await shot('showcase-terms')
  })
  await test('Auth: Google sin configuración ofrece salida sin crear sesión', async () => {
    await navigate('/login/google'); await fill('input[type=email]', 'test@unsa.edu.pe'); await button('Solicitar autorización de Google')
    await wait("document.body.innerText.includes('no está disponible o no está configurado')")
    assert.equal(await evaluate("sessionStorage.getItem('cs-prestamos-session')"), null); await shot('consumidor-auth')
  })
  await session('USUARIO')
  await test('Inventory: detalle real muestra accesorios y política', async () => {
    await navigate('/app/catalog/resource-test'); await wait("document.body.innerText.includes('Cable de prueba')")
    assert.ok(await evaluate("document.body.innerText.includes('2 días')"))
    assert.equal(result.requests.some(request => request.path.includes('/resource/resource-test/history')), false)
    await shot('consumidor-inventory')
  })
  await test('Loans: reservas propias a demanda y diálogo cancelable', async () => {
    await navigate('/app/reservations'); const before = result.requests.filter(request => request.path.startsWith('/api/loans/reservations')).length
    await button('Consultar / actualizar reservas'); await wait("document.body.innerText.includes('TEST-001')")
    assert.equal(result.requests.filter(request => request.path.startsWith('/api/loans/reservations')).length, before + 1)
    await button('Cancelar mi reserva'); await wait("!!document.querySelector('dialog[open]')"); await shot('consumidor-loans')
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await wait("!document.querySelector('dialog[open]')")
  })
  await session('ADMINISTRADOR')
  await test('Trust: consultar bandeja muestra apelación real y detalle', async () => {
    await navigate('/app/admin/appeals'); await button('Consultar bandeja'); await wait("document.body.innerText.includes('Revisión solicitada')")
    await shot('consumidor-trust')
  })
  assert.equal(result.errors.length, 0, JSON.stringify(result.errors))
} catch (error) { result.fatal = String(error); console.error(error) }
finally {
  if (page) { await evaluate('sessionStorage.clear();localStorage.clear()').catch(() => {}); page.close() }
  if (browser) { await browser.send('Browser.close').catch(() => {}); browser.close() }
  await sleep(500)
  if (chrome?.exitCode === null) spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'])
  if (server) await new Promise(done => server.close(done))
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  result.cleanup = { serverClosed: true, temporaryProfileRemoved: true }
  writeFileSync(resolve(out, affectedOnly ? 'browser-afectados.json' : 'browser-resultados.json'), JSON.stringify(result, null, 2))
  if (result.fatal || result.cases.some(item => !item.pass) || result.errors.length) process.exitCode = 1
}
