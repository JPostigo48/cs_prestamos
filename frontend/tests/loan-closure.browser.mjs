// Smoke visual aislado: bundle y fixtures en memoria, API real inaccesible.
import assert from 'node:assert/strict'
import { build } from 'vite'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { session } from './helpers/modules.mjs'
import { activeLoan, returnPolicy, returnBody, closedLoan } from './helpers/loan-closure-fixtures.mjs'
const root = fileURLToPath(new URL('..', import.meta.url))
const profile = mkdtempSync(root + '/node_modules/.closure-browser-')
const origin = 'http://127.0.0.1:4193'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server, child, socket
let sequence = 0
const pending = new Map(), exceptions = []
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timeout')) }, 15000)
  pending.set(id, message => { clearTimeout(timer); message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result) })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result.value
}
async function wait(expression) {
  for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await sleep(100) }
  throw new Error('No se cumplió: ' + expression)
}
const click = text => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(${JSON.stringify(text)})).click()`)
const fixture = {
  session: session('OPERADOR'), loan: activeLoan(), policy: returnPolicy(), result: closedLoan(activeLoan(), returnBody()),
  copy: { id: 'copy', recursoId: 'resource', codigoInventario: 'FIXTURE-COPY', estado: 'PRESTADO', condicionFisica: 'APTO', habilitado: true, recurso: { id: 'resource', nombre: 'Equipo histórico de prueba', categoriaId: 'category' } },
}
try {
  const bundle = await build({ root, envFile: false, build: { write: false }, logLevel: 'error' })
  const assets = new Map(bundle.output.map(item => ['/' + item.fileName, item.type === 'asset' ? item.source : item.code]))
  server = createServer((req, res) => {
    const path = new URL(req.url, origin).pathname
    // Sin proxy ni fallback hacia servicios: una API no interceptada falla localmente.
    if (path.startsWith('/api/')) { res.writeHead(503); res.end('API real deshabilitada en smoke offline'); return }
    const name = assets.has(path) ? path : path.startsWith('/app/') ? '/index.html' : path
    if (!assets.has(name)) { res.writeHead(404); res.end(); return }
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : 'application/octet-stream')
    res.end(assets.get(name))
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4193, '127.0.0.1', resolve) })
  child = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9353', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', '--disable-sync', '--disable-extensions', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=127.0.0.1;localhost', 'about:blank'], { stdio: 'ignore' })
  let targets
  for (let i = 0; i < 80; i++) { try { targets = await (await fetch('http://127.0.0.1:9353/json/list')).json(); break } catch { await sleep(100) } }
  assert.ok(targets, 'Edge no abrió CDP local')
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id) }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
    if (message.method === 'Fetch.requestPaused') {
      const url = new URL(message.params.request.url)
      void send(url.origin === origin && !url.pathname.startsWith('/api/') ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId: message.params.requestId, ...(url.origin === origin && !url.pathname.startsWith('/api/') ? {} : { errorReason: 'BlockedByClient' }) })
    }
  }
  await send('Runtime.enable'); await send('Page.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const f = ${JSON.stringify(fixture)};
    localStorage.setItem('cs-prestamos-session', JSON.stringify(f.session));
    sessionStorage.clear(); window.fixtureCalls = []; window.fixtureClosed = false;
    window.fetch = async (input, options = {}) => {
      const path = new URL(String(input), location.origin).pathname;
      const method = options.method || 'GET'; window.fixtureCalls.push({ path, method, body: options.body });
      if (path.endsWith('/return-policy')) return Response.json(f.policy);
      if (path.endsWith('/evidence')) return Response.json([]);
      if (path.endsWith('/return') || path.endsWith('/close-incident')) {
        const body = JSON.parse(options.body), incident = path.endsWith('/close-incident');
        window.fixtureClosed = true;
        return Response.json({ ...f.result, status: incident ? 'CERRADO_POR_INCIDENCIA' : 'FINALIZADO', return: incident ? null : f.result.return,
          closure: { ...f.result.closure, requestId: body.requestId, reason: incident ? body.kind : 'DEVOLUCION', inspection: incident ? null : { id: 'inspection', ...body.inspection } },
          reward: incident ? null : f.result.reward, copy: { ...f.result.copy, estado: 'NO_DISPONIBLE', condicionFisica: incident ? 'PERDIDO' : 'DANADO' } });
      }
      if (path.endsWith('/active') || path.endsWith('/overdue')) return Response.json(window.fixtureClosed ? [] : [f.loan]);
      if (path.includes('/inventory/copies/')) return Response.json(f.copy);
      if (path.includes('/users/')) return Response.json({ id: f.loan.userId, name: 'Titular fixture', userType: 'DOCENTE' });
      throw new Error('Petición no simulada: ' + path);
    };` })
  for (const width of [1440, 375]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: origin + '/app/loans' })
    await wait(`document.body.innerText.includes('Equipo histórico de prueba')`)
    await click('Registrar devolución')
    await wait(`!!document.querySelector('dialog[open] select')`)
    assert.equal(await evaluate(`document.querySelector('dialog[open]').contains(document.activeElement)`), true)
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('dialog input[type=radio]')).some(e => e.checked)`), false)
    assert.equal(await evaluate(`document.querySelector('dialog select').value`), '')
    const geometry = await evaluate(`({ global: document.documentElement.scrollWidth <= innerWidth, dialog: document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth, width: document.querySelector('dialog').getBoundingClientRect().width })`)
    assert.equal(geometry.global, true); assert.equal(geometry.dialog, true)
    await evaluate(`const select = document.querySelector('dialog select'); select.value = 'false'; select.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('dialog input[value=DANADO]').click();`)
    await wait(`document.querySelectorAll('dialog select').length === 3`)
    await evaluate(`Array.from(document.querySelectorAll('dialog select')).slice(1).forEach((e, i) => { e.value = i ? 'GRAVE' : 'LEVE'; e.dispatchEvent(new Event('change', { bubbles: true })); }); const area = document.querySelector('dialog textarea'); area.value = 'Daño y cable faltante comprobados'; area.dispatchEvent(new Event('input', { bubbles: true }));`)
    await wait(`!document.querySelector('dialog button.primary').disabled`)
    await click('Confirmar devolución integral')
    await wait(`document.querySelector('dialog').innerText.includes('Devolución real confirmada')`)
    assert.equal(await evaluate(`document.activeElement.tagName`), 'H3')
    const writes = await evaluate(`fixtureCalls.filter(c => c.method === 'POST')`)
    assert.equal(writes.length, 1); assert.equal(JSON.parse(writes[0].body).inspection.damageSeverity, 'GRAVE')
    assert.equal('returnedAt' in JSON.parse(writes[0].body), false)
    assert.match(await evaluate(`document.querySelector('dialog').innerText`), /Retenido/)
    await evaluate(`document.querySelector('dialog button[aria-label="Cerrar diálogo"]').click()`)
    await wait(`!document.querySelector('dialog[open]')`)
    await send('Page.navigate', { url: origin + '/app/loans' })
    await wait(`document.body.innerText.includes('Equipo histórico de prueba')`)
    await click('Cerrar por pérdida o robo')
    await wait(`!!document.querySelector('dialog textarea')`)
    await evaluate(`const area = document.querySelector('dialog textarea'); area.value = 'Pérdida confirmada por el titular'; area.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('dialog input[type=checkbox]').click();`)
    await wait(`!document.querySelector('dialog button.primary').disabled`)
    await click('Confirmar cierre por incidencia')
    await wait(`document.querySelector('dialog').innerText.includes('Cierre por pérdida')`)
    assert.match(await evaluate(`document.querySelector('dialog').innerText`), /Sin recompensa/)
    const screenshot = await send('Page.captureScreenshot', { format: 'png' })
    mkdirSync(root + '/tests/artifacts', { recursive: true })
    writeFileSync(root + '/tests/artifacts/loan-closure-' + width + '.png', Buffer.from(screenshot.data, 'base64'))
    console.log('PASS devolución/daño/faltantes/pérdida, foco y geometría', width, geometry)
  }
  assert.deepEqual(exceptions, [])
} finally {
  socket?.close(); child?.kill()
  if (server) await new Promise(resolve => server.close(resolve))
  await sleep(500)
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
