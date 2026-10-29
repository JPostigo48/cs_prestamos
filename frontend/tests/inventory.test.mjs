import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { load, testEnvironment, session } from './helpers/modules.mjs'
const auth = await load('modules/auth/api/auth-api')
const inventory = await load('modules/inventory/api/inventory-api')
beforeEach(() => {
  testEnvironment()
  auth.saveSession(session('ADMINISTRADOR'))
})
test('recurso: crear/editar solo datos básicos; no cantidad, códigos, duración ni accesorios', async () => {
  const body = { nombre: 'Equipo de prueba', categoriaId: 'category1' }
  const paths = []
  globalThis.fetch = async (url, options) => {
    paths.push(url)
    assert.deepEqual(JSON.parse(options.body), body)
    return Response.json(
      { id: 'resource1', ...body },
      { status: options.method === 'POST' ? 201 : 200 },
    )
  }
  await inventory.saveResource(null, body)
  await inventory.saveResource('resource1', body)
  assert.deepEqual(paths, ['/api/inventory/resources', '/api/inventory/resources/resource1'])
  globalThis.fetch = async () => Response.json(null)
  await assert.rejects(inventory.saveResource(null, body), (e) => e.status === 0)
})
test('ejemplar: código explícito y recurso real, RESERVADO se conserva en lectura', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/inventory/resources/r1/copies')
    assert.deepEqual(JSON.parse(options.body), { codigoInventario: 'INV-TEST' })
    return Response.json(
      { id: 'c1', recursoId: 'r1', codigoInventario: 'INV-TEST', estado: 'DISPONIBLE' },
      { status: 201 },
    )
  }
  await inventory.createCopy('r1', ' INV-TEST ')
  globalThis.fetch = async () => Response.json([{ id: 'c1', estado: 'RESERVADO' }])
  assert.equal((await inventory.getCopies('r1'))[0].estado, 'RESERVADO')
})
test('ocupación: frontend no libera prestados/reservados y revalida antes de PATCH', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json({ id: 'c1', estado: 'RESERVADO' })
  }
  for (const estado of ['RESERVADO', 'PRESTADO'])
    await assert.rejects(
      inventory.changeCopyState({ id: 'c1', estado }, 'DISPONIBLE'),
      (e) => e.status === 409,
    )
  assert.equal(calls, 0)
  await assert.rejects(
    inventory.changeCopyState({ id: 'c1', estado: 'DISPONIBLE' }, 'NO_DISPONIBLE'),
    (e) => e.status === 409,
  )
  assert.equal(calls, 1)
})
test('duración: horas son autoridad aun con días inconsistentes', () => {
  assert.equal(
    inventory.durationLabel({ tiempoMaximoPrestamoDias: 9, tiempoMaximoPrestamoHoras: 48 }),
    '2 días',
  )
  assert.equal(
    inventory.durationLabel({ tiempoMaximoPrestamoDias: 1, tiempoMaximoPrestamoHoras: 4 }),
    '4 horas',
  )
})
test('guardado parcial: accesorios y excepción no se confirman con respuesta incompatible', async () => {
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/accessories')) {
      assert.deepEqual(JSON.parse(options.body), { items: [{ nombre: 'Cable' }] })
      return Response.json({ items: [] })
    }
    if (url.endsWith('/loan-policy'))
      return Response.json({ resourceId: 'other', durationHours: 12 })
    assert.fail('URL inesperada: ' + url)
  }
  await assert.rejects(inventory.saveAccessories('r1', ['Cable']))
  await assert.rejects(inventory.saveLoanPolicy('r1', 12))
})
test('accesorios: usa resourceId, JWT, PUT real e IDs estables al renombrar', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    assert.ok(options.headers.Authorization.startsWith('Bearer '))
    if (options.method === 'PUT') {
      assert.deepEqual(JSON.parse(options.body), { items: [{ id: 'a1', nombre: 'Adaptador' }] })
      return Response.json({ items: [{ id: 'a1', nombre: 'Adaptador' }] })
    }
    return Response.json({ items: [{ id: 'a1', nombre: 'Cargador' }] })
  }
  assert.deepEqual((await inventory.getAccessories('r/1')).items, [{ id: 'a1', nombre: 'Cargador' }])
  assert.deepEqual((await inventory.saveAccessories('r/1', [{ id: 'a1', nombre: ' Adaptador ' }])).items, [{ id: 'a1', nombre: 'Adaptador' }])
  assert.equal(calls[0].url, '/api/inventory/resources/r%2F1/accessories')
  assert.equal(calls[1].options.method, 'PUT')
  globalThis.fetch = async () => Response.json({ items: [{ id: 'a1', nombre: 'Adaptador' }, { id: 'a1', nombre: 'Otro' }] })
  await assert.rejects(inventory.getAccessories('r1'), e => e.status === 0)
})
test('duración: confirma excepción efectiva y null hereda, propaga denegación y errores de persistencia', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/inventory/resources/r1/loan-policy')
    assert.equal(options.method, 'PATCH')
    const { durationHours } = JSON.parse(options.body)
    return Response.json({ resourceId: 'r1', categoryId: 'cat1', durationHours, effectiveDurationHours: durationHours ?? 8, source: durationHours === null ? 'CATEGORY' : 'RESOURCE' })
  }
  assert.equal((await inventory.saveLoanPolicy('r1', 3)).effectiveDurationHours, 3)
  assert.equal((await inventory.saveLoanPolicy('r1', null)).source, 'CATEGORY')
  for (const status of [403, 404, 409, 500]) {
    globalThis.fetch = async () => Response.json({ message: 'No confirmado' }, { status })
    await assert.rejects(inventory.saveLoanPolicy('r1', 8), e => e.status === status)
    await assert.rejects(inventory.saveAccessories('r1', []), e => e.status === status)
  }
})
