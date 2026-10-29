import test from 'node:test'
import assert from 'node:assert/strict'
import { loadComponent } from './helpers/modules.mjs'
import { mount, flush, find, event, text } from './helpers/renderer.mjs'

const Section = await loadComponent('shared/components/RemoteSection')
test('consulta real a demanda: carga, error normal, reintento, vacío y respuesta', async () => {
  let calls = 0
  let resolve
  const app = mount(Section, {
    title: 'Consulta',
    load: async () => {
      calls++
      if (calls === 1) return new Promise(done => { resolve = done })
      if (calls === 2) throw new Error('Validación de negocio')
      if (calls === 3) return []
      return { id: 'real' }
    },
    isEmpty: value => Array.isArray(value) && value.length === 0,
  })
  try {
    await flush()
    assert.equal(calls, 0)
    const click = event(find(app.root, 'button'), 'click')
    await flush()
    assert.equal(find(app.root, 'button').props.disabled, true)
    assert.match(text(app.root), /Consultando/)
    resolve({ id: 'first' })
    await click
    assert.match(text(app.root), /Respuesta recibida/)
    await event(find(app.root, 'button'), 'click')
    assert.match(text(app.root), /Validación de negocio/)
    assert.equal(find(app.root, 'p', 'Validación').props.role, 'alert')
    await event(find(app.root, 'button'), 'click')
    assert.match(text(app.root), /No hay resultados/)
    await event(find(app.root, 'button'), 'click')
    assert.match(text(app.root), /Respuesta recibida/)
    assert.equal(calls, 4)
  } finally { app.unmount() }
})

test('desmontar aborta la consulta en curso', async () => {
  let signal
  const app = mount(Section, { title: 'Consulta', load: async value => {
    signal = value
    return new Promise(resolve => value.addEventListener('abort', () => resolve([]), { once: true }))
  } })
  const click = event(find(app.root, 'button'), 'click')
  await flush()
  app.unmount()
  assert.equal(signal.aborted, true)
  await click
})
