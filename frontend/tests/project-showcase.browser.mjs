// Smoke mínimo basado en el harness CDP local: sin API, entorno ni informes.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { preview } from 'vite'

const chrome = ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!chrome) { console.log('SKIP: Chrome local no disponible'); process.exit(0) }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
class CDP {
  constructor(url) {
    this.socket = new WebSocket(url)
    this.pending = new Map()
    this.id = 0
    this.ready = new Promise((resolve, reject) => { this.socket.onopen = resolve; this.socket.onerror = reject })
    this.socket.onmessage = event => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        clearTimeout(pending.timer)
        this.pending.delete(message.id)
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)))
        else pending.resolve(message.result)
      } else this.onEvent?.(message)
    }
  }
  async send(method, params = {}) {
    await this.ready
    const id = ++this.id
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 12000)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }
  close() { this.socket.close() }
}
const origin = 'http://127.0.0.1:4187'
const profile = mkdtempSync(join(tmpdir(), 'showcase-smoke-'))
let server, child, browser, page
const errors = [], unexpectedRequests = []
try {
  server = await preview({ root: fileURLToPath(new URL('..', import.meta.url)), envFile: false, preview: { host: '127.0.0.1', port: 4187, strictPort: true } })
  assert.equal(server.config.envFile, false)
  child = spawn(chrome, ['--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9347', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--disable-default-apps', '--disable-domain-reliability', '--metrics-recording-only', '--safebrowsing-disable-auto-update', '--no-pings', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=127.0.0.1;localhost', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost', 'about:blank'], { stdio: 'ignore' })
  let info
  for (let attempt = 0; attempt < 80; attempt++) {
    try { info = await (await fetch('http://127.0.0.1:9347/json/version')).json(); break } catch { await sleep(100) }
  }
  assert.ok(info, 'Chrome no abrió CDP')
  browser = new CDP(info.webSocketDebuggerUrl)
  const targets = await (await fetch('http://127.0.0.1:9347/json/list')).json()
  page = new CDP(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  page.onEvent = message => {
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params
      const allowed = request.url.startsWith(origin + '/') && !new URL(request.url).pathname.startsWith('/api')
      if (!allowed) unexpectedRequests.push(request.url)
      page.send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed ? { requestId } : { requestId, errorReason: 'BlockedByClient' }).catch(error => errors.push(String(error)))
    }
  }
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
  const evaluate = async expression => {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  const wait = async expression => {
    for (let attempt = 0; attempt < 80; attempt++) { if (await evaluate(expression)) return; await sleep(100) }
    throw new Error(`No se cumplió: ${expression}`)
  }
  const geometry = async () => {
    const result = await evaluate(`(() => {
      const root = document.querySelector('.project-layout'), header = root.querySelector('header'), main = root.querySelector('main');
      return { top: header.getBoundingClientRect().top, bottom: header.getBoundingClientRect().bottom, contentTop: main.getBoundingClientRect().top, globalOverflow: document.documentElement.scrollWidth > innerWidth, localOverflow: root.scrollWidth > root.clientWidth + 1 };
    })()`)
    assert.equal(result.top, 0, JSON.stringify(result))
    assert.equal(result.globalOverflow, false, JSON.stringify(result))
    assert.equal(result.localOverflow, false, JSON.stringify(result))
    return result
  }
  for (const width of [320, 1440]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    for (const route of ['/project/api', '/project/db']) {
      await page.send('Page.navigate', { url: origin + route })
      await wait(route.endsWith('api') ? `document.querySelectorAll('summary .access-trigger').length > 0` : `document.querySelectorAll('.database-page h3').length === 29`)
      const initial = await geometry()
      assert.ok(initial.contentTop >= initial.bottom, JSON.stringify(initial))
      await evaluate(`document.querySelector('.project-layout').scrollTop = 600`)
      await sleep(80)
      await geometry()
      await evaluate(`document.querySelector('.project-layout').scrollTop = 0`)
      if (route.endsWith('api')) {
        const point = await evaluate(`(() => { const button = document.querySelector('summary .access-trigger'); button.scrollIntoView({block:'center', behavior:'instant'}); const r=button.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`)
        await sleep(120) // Espera el scroll programático antes de simular el hover.
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point })
        await wait(`!!document.querySelector('[role=tooltip]')`)
        const tooltip = await evaluate(`(() => { const t=document.querySelector('[role=tooltip]'),r=t.getBoundingClientRect(); return {left:r.left,right:r.right,text:t.textContent}; })()`)
        assert.ok(tooltip.left >= 0 && tooltip.right <= width, JSON.stringify(tooltip))
        await evaluate(`document.querySelector('summary .access-trigger').focus()`)
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
        await wait(`!document.querySelector('[role=tooltip]')`)
        assert.equal(await evaluate(`document.activeElement.matches('.access-trigger')`), true)
        await page.send('Emulation.setTouchEmulationEnabled', { enabled: true })
        await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
        await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await wait(`!!document.querySelector('[role=tooltip]')`)
        assert.equal(await evaluate(`document.querySelector('summary .access-trigger').closest('details').open`), false)
        await page.send('Emulation.setTouchEmulationEnabled', { enabled: false })
      }
      console.log(`PASS Chrome ${width}px ${route}: header top0, contenido sin tapar, sin overflow${route.endsWith('api') ? ', tooltip hover/foco/Escape/touch' : ', 19 modelos/10 enums'}`)
    }
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpectedRequests, [])
  console.log('PASS smoke sin API ni solicitudes externas')
} finally {
  if (browser) await browser.send('Browser.close').catch(() => {})
  page?.close(); browser?.close()
  if (child && child.exitCode === null) { child.kill(); await sleep(400) }
  if (server) await new Promise(resolve => server.httpServer.close(resolve))
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
}
