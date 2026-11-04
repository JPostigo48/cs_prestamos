import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, loadComponent, testEnvironment } from './helpers/modules.mjs'
import { mount, find, findAll, text, event, flush } from './helpers/renderer.mjs'

const { trustLevel } = await load('modules/trust/trust-level')
const TrustMeter = await loadComponent('modules/trust/components/TrustMeter')
beforeEach(testEnvironment)

const HEX = /^#[0-9a-f]{6}$/i

test('trust-level: los cuatro niveles y un desconocido caen en estado seguro', () => {
  const known = [
    ['EXCELENTE', 'Excelente', 'success'],
    ['CONFIABLE', 'Confiable', 'info'],
    ['EN_OBSERVACION', 'En observación', 'warning'],
    ['CRITICO', 'Crítico', 'danger'],
  ]
  for (const [level, label, tone] of known) {
    const info = trustLevel(level)
    assert.equal(info.label, label)
    assert.equal(info.tone, tone)
    assert.match(info.color, HEX)
  }
  for (const unknown of ['OTRO_NIVEL', '', 'excelente', null, undefined, 42]) {
    const info = trustLevel(unknown)
    assert.equal(info.label, 'Confianza no disponible')
    assert.equal(info.tone, 'neutral')
    assert.match(info.color, HEX)
  }
})

const meter = (props = {}) => mount(TrustMeter, { percentage: 75, level: 'CONFIABLE', currentlyPenalized: false, ...props })
const meterNode = app => findAll(app.root, n => n.props.role === 'meter')[0]
const byClass = (app, className) => findAll(app.root, n => n.props.class === className)[0]
const elementTexts = node => node.children.filter(child => child.tag !== '#text' && child.tag !== '#comment').map(child => text(child))

test('trust-meter: el ancho de la barra queda limitado entre 0 y 100', async () => {
  for (const [percentage, expectedValue, expectedWidth] of [
    [150, 100, '100%'],
    [-20, 0, '0%'],
    [75, 75, '75%'],
    [75.4, 75.4, '75.4%'],
    [Number.NaN, 0, '0%'],
  ]) {
    const app = meter({ percentage })
    try {
      const node = meterNode(app)
      assert.ok(node, 'el medidor expone role="meter"')
      assert.equal(node.props['aria-valuenow'], expectedValue)
      assert.equal(node.props['aria-valuemin'], '0')
      assert.equal(node.props['aria-valuemax'], '100')
      assert.equal(node.props['aria-label'], 'Nivel de confianza')
      assert.equal(byClass(app, 'bar-fill').props.style.width, expectedWidth)
    } finally { app.unmount() }
  }
})

test('trust-meter: encabezado con nivel en español, porcentaje redondeado y aviso de sanción', async () => {
  const penalized = meter({ percentage: 75.4, level: 'EN_OBSERVACION', currentlyPenalized: true })
  try {
    assert.match(text(penalized.root), /Confianza/)
    assert.match(text(penalized.root), /En observación/)
    assert.equal(text(findAll(penalized.root, n => n.tag === 'span' && n.props.class === 'meter-value')[0]), '75 %')
    assert.match(text(penalized.root), /Tienes una sanción vigente\. Puede impedirte reservar o pedir préstamos aunque tu nivel de confianza lo permita\./)
  } finally { penalized.unmount() }

  const clean = meter({ percentage: 90.6, level: 'EXCELENTE', currentlyPenalized: false })
  try {
    assert.match(text(clean.root), /Excelente/)
    assert.equal(text(findAll(clean.root, n => n.tag === 'span' && n.props.class === 'meter-value')[0]), '91 %')
    assert.doesNotMatch(text(clean.root), /sanción vigente/)
  } finally { clean.unmount() }
})

test('trust-meter: escala 0-100, tarjeta compacta y explicación completa en diálogo sin IDs técnicos', async () => {
  const app = meter({ percentage: 60, level: 'CONFIABLE', currentlyPenalized: false })
  try {
    const scale = byClass(app, 'bar-scale')
    assert.deepEqual(elementTexts(scale), ['0', '25', '50', '75', '100'])
    const segments = byClass(app, 'bar-segments')
    assert.deepEqual(elementTexts(segments), ['Crítico', 'En observación', 'Confiable', 'Excelente'])
    assert.doesNotMatch(text(app.root), /30 min de tolerancia/, 'la tarjeta no crece con la explicación')
    assert.equal(findAll(app.root, n => n.tag === 'svg').length, 1, 'solo el icono de información')
    const opener = find(app.root, 'button', '¿Cómo se calcula?')
    assert.ok(opener, 'la tarjeta ofrece un enlace a la explicación')
    assert.equal(opener.props['aria-haspopup'], 'dialog')

    opener.focus()
    await event(opener, 'click')
    const dialog = find(app.root, 'dialog', '¿Cómo se calcula mi confianza?')
    assert.ok(dialog, 'el diálogo se abre con el título completo')
    const body = text(dialog)
    assert.match(body, /Niveles/)
    assert.match(body, /Excelente 75–100 %/)
    assert.match(body, /Confiable 50–74 %/)
    assert.match(body, /En observación 25–49 %/)
    assert.match(body, /Crítico 0–24 %/)
    assert.match(body, /Cómo sube/)
    assert.match(body, /\+3 en electrónicos, \+1 en libros y deportes/)
    assert.match(body, /Cómo baja/)
    assert.match(body, /Devolver tarde, dañar el recurso o dejar piezas faltantes/)
    assert.match(body, /30 min de tolerancia/)
    assert.match(body, /pérdida o el robo lleva tu confianza a 0 %/)
    assert.match(body, /Qué puedes reservar/)
    assert.match(body, /Electrónicos solo con nivel Excelente o Confiable/)
    assert.match(body, /Libros y deportes también con En observación/)
    assert.match(body, /Con Crítico no puedes reservar nada/)
    assert.match(body, /Los valores son de referencia y pueden cambiar con nuevas versiones de las reglas\./)
    assert.doesNotMatch(text(app.root), /userId|11111111/)

    const understood = find(dialog, 'button', 'Entendido')
    assert.ok(understood, 'el diálogo ofrece Entendido')
    await event(understood, 'click')
    await flush()
    assert.equal(find(app.root, 'dialog'), undefined, 'Entendido cierra el diálogo')
    assert.equal(document.activeElement, opener, 'el foco vuelve al botón que lo abrió')

    await event(opener, 'click')
    const reopened = find(app.root, 'dialog', '¿Cómo se calcula mi confianza?')
    assert.ok(reopened, 'se reabre para comprobar Esc')
    await event(reopened, 'cancel')
    assert.equal(find(app.root, 'dialog'), undefined, 'Esc (cancel) cierra el diálogo')
  } finally { app.unmount() }
})
