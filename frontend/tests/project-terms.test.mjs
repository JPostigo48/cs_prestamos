import test from 'node:test'
import assert from 'node:assert/strict'
import { load, loadComponent } from './helpers/modules.mjs'
import { event, find, findAll, flush, mount, text } from './helpers/renderer.mjs'

const presentation = await load('modules/project-showcase/services/termsPresentation')
const Page = await loadComponent('modules/project-showcase/pages/ProjectTermsPage')
const policy = {
  id: 'policy-version', ruleId: 'rule', number: 8, title: 'Regla de prueba', key: 'R-TEST',
  kind: 'LATENESS', category: 'CATEGORIA_DE_PRUEBA', categoryId: 'category', severity: 'LEVE',
  trustEffect: 'DISCOUNT', penaltyPoints: 0, suspensionType: 'NINGUNA', suspensionDays: null,
  consequence: 'Consecuencia enviada por API', criteria: { condition: 'Condición enviada por API', delayHours: { exclusiveMin: 0, inclusiveMax: 2.5 } },
}
const terms = { id: 'terms-version', number: 42, title: 'Versión de prueba remota', content: '# Términos de prueba\n\n## Apelaciones\nContenido remoto de apelación\n\n## Aceptación\nContenido remoto de aceptación', publishedAt: '2026-10-19T12:00:00Z', policiesStatus: 'COMPLETE', policies: [policy] }
const response = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('distingue cero, no aplica, indefinido y desconocido sin políticas constantes', () => {
  assert.equal(presentation.confidenceLabel(policy), '−0 puntos porcentuales')
  assert.equal(presentation.confidenceLabel({ ...policy, penaltyPoints: null }), 'Descuento desconocido')
  assert.equal(presentation.confidenceLabel({ ...policy, trustEffect: 'SET_ZERO' }), 'Establecer confianza en cero')
  assert.equal(presentation.suspensionLabel(policy), 'Sin suspensión')
  assert.equal(presentation.suspensionLabel({ ...policy, suspensionType: null }), 'Suspensión desconocida')
  assert.equal(presentation.suspensionLabel({ ...policy, suspensionType: 'INDEFINIDA' }), 'Bloqueo indefinido')
  assert.equal(presentation.suspensionLabel({ ...policy, suspensionType: 'TEMPORAL' }), 'Duración desconocida')
  assert.match(presentation.criteriaDetails(policy)[0].value, /2.5/)
  assert.equal(presentation.publicationLabel(null), 'Fecha desconocida')
})

test('consulta API pública, muestra versión remota y acordeones nativos sin HTML ejecutable', async () => {
  let finish
  const requests = []
  globalThis.fetch = (url, options) => {
    requests.push({ url, options })
    return new Promise(resolve => { finish = resolve })
  }
  const page = mount(Page)
  assert.match(text(page.root), /Cargando términos/)
  finish(response(200, { ...terms, content: terms.content + '\n<script>no ejecutar</script>' }))
  await flush()
  assert.equal(requests[0].url, '/api/terms/current')
  assert.equal(requests[0].options.method, 'GET')
  assert.equal(requests[0].options.headers.Authorization, undefined)
  assert.match(text(page.root), /Versión 42/)
  assert.match(text(page.root), /Consecuencia enviada por API/)
  assert.match(text(page.root), /Contenido remoto de apelación/)
  assert.match(text(page.root), /Contenido remoto de aceptación/)
  assert.ok(findAll(page.root, node => node.tag === 'details').length >= 3)
  assert.ok(findAll(page.root, node => node.tag === 'summary').length >= 3)
  assert.equal(findAll(page.root, node => node.tag === 'script').length, 0)
  page.unmount()
})

test('ausencia y error permiten reintentar y cargar, sin snapshots de respaldo', async () => {
  const replies = [response(404, { message: 'Sin términos' }), response(503, { message: 'Servicio no disponible' }), response(200, { ...terms, policiesStatus: 'INCOMPLETE' })]
  globalThis.fetch = async () => replies.shift()
  const page = mount(Page)
  await flush()
  assert.match(text(page.root), /No hay términos publicados/)
  assert.doesNotMatch(text(page.root), /Versión 42/)
  await event(find(page.root, 'button', 'Volver a intentar'), 'click')
  assert.match(text(page.root), /Servicio no disponible/)
  await event(find(page.root, 'button', 'Volver a intentar'), 'click')
  assert.match(text(page.root), /Versión 42/)
  assert.match(text(page.root), /matriz vinculada a esta versión está incompleta/)
  page.unmount()
})

test('incluye todos los campos estructurados de acceso, confianza, reserva y recompensa', () => {
  const details = presentation.criteriaDetails({ ...policy, criteria: { condition: 'Test', noShow: { inclusiveMin: 2, inclusiveMax: null, rollingDays: 17, pickupMinutes: 23 }, reward: { referencePoints: 20, fraction: 0.2, maximumTrust: 90 }, access: { allowedLevels: ['NIVEL_TEST'], durationHours: 11, campusOnly: true }, trust: { initial: 60, minimum: 0, maximum: 90, decimals: 2, levels: [{ name: 'NIVEL_TEST', inclusiveMin: 60, exclusiveMax: null }] } } })
  const output = JSON.stringify(details)
  for (const value of ['17 días', '23 minutos', '+4 puntos', '11 horas', '60 %', '≤ 90']) assert.ok(output.includes(value), value)
  assert.ok(presentation.termsSections('## Texto\n<!-- epcc.policy-versions/v1: ["id"] -->\nPublicado')[0].body.includes('Publicado'))
  assert.ok(!JSON.stringify(presentation.termsSections('## Texto\n<!-- epcc.policy-versions/v1: ["id"] -->')).includes('epcc.policy'))
})
