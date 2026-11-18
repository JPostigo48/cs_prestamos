// Smoke offline focalizado; Edge/Chromium local, sin backend ni archivos de entorno.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import { session } from './helpers/modules.mjs'
import { sanction, rule, userId } from './helpers/trust-fixtures.mjs'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const profile = mkdtempSync(fileURLToPath(new URL('../node_modules/.ux-browser-', import.meta.url)))
const origin = 'http://127.0.0.1:4189'
let server, child, socket
let sequence = 0
const pending = new Map(), errors = []
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timeout')) }, 10000)
  pending.set(id, message => { clearTimeout(timer); message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result) })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}
const wait = async expression => {
  for (let i = 0; i < 70; i++) { if (await evaluate(expression)) return; await sleep(100) }
  throw new Error('No se cumplió: ' + expression)
}
const instant = days => new Date(Date.now() + days * 86400000).toISOString()
const loan = { id: 'loan-fixture', userId, copyId: 'copy-fixture', status: 'FINALIZADO', startsAt: instant(-4), endsAt: instant(-1), return: { returnedAt: instant(-2) }, configurationSnapshot: null, returnChecklist: null }
const reservation = { id: 'reservation-fixture', userId, copyId: loan.copyId, status: 'RECOGIDA', requestedAt: instant(-5), pickupDeadline: instant(-4), pickedUpAt: instant(-4), cancelledAt: null, cancellationReason: null, loanId: loan.id, loanDurationHours: 24, configurationSnapshot: null }
const detail = sanction({ status: 'FINALIZADA', startsAt: instant(-1), endsAt: instant(-1), reason: null, violationId: 'violation-fixture', previousTrust: 100, resultingTrust: 98, rule: rule({ title: 'R-RES:LEVE', description: JSON.stringify({ format: 'epcc.official-policy/v1', kind: 'NO_SHOW' }), suspensionType: 'NINGUNA', suspensionDays: null }) })
const fixtures = {
  loan, reservation, detail, session: session(),
  profile: { id: userId, name: 'Usuario de prueba UX', userType: 'ESTUDIANTE', institutionalId: null, hasCurrentAffiliation: true, trustPercentage: 98 },
}
try {
  server = await preview({ root: fileURLToPath(new URL('..', import.meta.url)), envFile: false, preview: { host: '127.0.0.1', port: 4189, strictPort: true } })
  assert.equal(server.config.envFile, false)
  child = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9349', `--user-data-dir=${profile}`, '--no-first-run', '--disable-background-networking', '--disable-sync', '--disable-extensions', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=127.0.0.1;localhost', 'about:blank'], { stdio: 'ignore' })
  let targets
  for (let i = 0; i < 80; i++) { try { targets = await (await fetch('http://127.0.0.1:9349/json/list')).json(); break } catch { await sleep(100) } }
  assert.ok(targets, 'Edge no abrió CDP')
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id) }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const f = ${JSON.stringify(fixtures)};
    localStorage.setItem('cs-prestamos-session', JSON.stringify(f.session));
    window.uxCalls = [];
    window.fetch = async (input, options = {}) => {
      const url = new URL(String(input), location.origin), p = url.pathname;
      window.uxCalls.push(p);
      let body;
      if (p.endsWith('/history')) body = [f.loan];
      else if (p.endsWith('/reservations')) body = { items: [f.reservation], total: 1, page: 1, limit: 100 };
      else if (p.startsWith('/api/inventory/copies/')) body = { id: f.loan.copyId, codigoInventario: 'UX-01', recurso: { id: 'resource-fixture', nombre: 'Libro de prueba UX' } };
      else if (p.endsWith('/sanctions')) body = [f.detail];
      else if (p.startsWith('/api/sanctions/')) body = f.detail;
      else if (p.endsWith('/appeals')) body = { items: [], total: 0, page: 1, limit: 20 };
      else if (p.endsWith('/trust')) body = { userId: f.session.user.id, percentage: 98, level: 'EXCELENTE', currentlyPenalized: false };
      else if (p.endsWith('/loan-eligibility')) body = { userId: f.session.user.id, enabled: true, reasons: [] };
      else if (p.endsWith('/categories')) body = [];
      else if (p.includes('/availability')) body = [];
      else if (p.startsWith('/api/users/')) body = f.profile;
      else if (p.includes('/terms/')) body = { id: 'terms-ux', number: 1, title: 'Condiciones de prueba', content: '# Documento completo\\n\\nTérminos de prueba UX.' };
      else throw new Error('Petición no simulada: ' + p);
      return Response.json(body);
    };` })
  for (const width of [1440, 375]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    for (const route of ['/register', '/app/history', '/app/personal']) {
      await send('Page.navigate', { url: origin + route })
      await wait(route === '/register' ? `!!document.querySelector('.registration-fields')` : route.endsWith('history') ? `document.querySelectorAll('.operation-card').length === 1` : `document.body.innerText.includes('Reserva no recogida')`)
      await sleep(100)
      const metrics = await evaluate(`({ overflow: document.documentElement.scrollWidth > innerWidth, width: document.querySelector('.registration-shell')?.getBoundingClientRect().width, columns: document.querySelector('.registration-fields') && getComputedStyle(document.querySelector('.registration-fields')).gridTemplateColumns, text: document.body.innerText })`)
      assert.equal(metrics.overflow, false, route + ' overflow a ' + width)
      if (route === '/register') {
        assert.ok(width === 1440 ? metrics.width >= 720 && metrics.width <= 900 : metrics.width <= width)
        const positions = await evaluate(`Array.from(document.querySelectorAll('.registration-fields > label')).slice(0,2).map(e => ({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}))`)
        assert.equal(positions[0].y === positions[1].y, width === 1440, JSON.stringify(positions))
        assert.equal(positions[0].x === positions[1].x, width === 375, JSON.stringify(positions))
        await evaluate(`document.querySelector('.terms-panel button').click()`)
        await wait(`!!document.querySelector('dialog[open] .terms-content')`)
        assert.equal(await evaluate(`document.querySelector('dialog[open]').contains(document.activeElement)`), true)
        await evaluate(`document.querySelector('dialog[open] > button:last-child').click()`)
        await wait(`!document.querySelector('dialog[open]')`)
      } else if (route.endsWith('history')) {
        assert.match(metrics.text, /Préstamo devuelto/)
        assert.match(metrics.text, /Originado en tu reserva/)
        assert.doesNotMatch(metrics.text, /Consultar \/ actualizar|\(Lima\)/)
      } else {
        assert.doesNotMatch(metrics.text, /R-RES|CONFIANZA_ACTUALIZADA|no aportó|Sin apelaciones vinculadas/)
        assert.ok(await evaluate(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Apelar sanción'))`))
      }
      console.log('PASS', width, route, route === '/register' ? { width: metrics.width, columns: metrics.columns } : 'sin overflow; datos y acciones correctos')
    }
  }
  assert.deepEqual(errors, [])
} finally {
  socket?.close()
  child?.kill()
  await server?.httpServer.close()
  await sleep(500)
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
