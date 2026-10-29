import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryHistory, createRouter } from 'vue-router'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, model } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const layout = await loadComponent('shared/layouts/AppLayout')
beforeEach(testEnvironment)
async function open(role, path = '/app') {
  auth.saveSession(session(role))
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push(path)
  await router.isReady()
  return { ...mount(layout, {}, [router]), router }
}

for (const [role, count] of [['USUARIO', 3], ['OPERADOR', 4], ['ADMINISTRADOR', 7]]) {
  test(`layout ${role}: Más conserva destinos y Salir elimina la sesión real`, async () => {
    const app = await open(role)
    try {
      const nav = findAll(app.root, n => n.props.id === 'app-navigation')[0]
      assert.equal(findAll(nav, n => n.tag === 'a').length, count)
      await event(find(app.root, 'button', 'Más'), 'click')
      assert.equal(findAll(app.root, n => n.props.class === 'content-shell')[0].props.inert, true)
      await event(findAll(app.root, n => n.props['aria-label'] === 'Cerrar navegación')[0], 'click')
      assert.equal(find(app.root, 'button', 'Más').props['aria-expanded'], false)
      assert.equal(findAll(app.root, n => n.props.class === 'content-shell')[0].props.inert, undefined)
      await event(find(app.root, 'button', 'Salir'), 'click')
      await flush()
      assert.equal(auth.getSession(), null)
      assert.equal(app.router.currentRoute.value.path, '/login')
    } finally { app.unmount() }
  })
}

test('detalle mantiene Catálogo seleccionado sin marcar Inicio; buscar conserva el contrato de ruta', async () => {
  const app = await open('USUARIO', '/app/catalog/resource-test')
  try {
    const nav = findAll(app.root, n => n.props.id === 'app-navigation')[0]
    const catalog = find(nav, 'a', 'Catálogo')
    assert.equal(catalog.props['aria-current'], 'location')
    assert.equal(find(nav, 'a', 'Inicio').props['aria-current'], undefined)
    await app.router.push('/app'); await flush()
    await model(find(app.root, 'input'), '  proyector  ')
    await event(find(app.root, 'form'), 'submit'); await flush()
    assert.equal(app.router.currentRoute.value.fullPath, '/app/catalog?search=proyector')
  } finally { app.unmount() }
})

for (const [role, destinations] of [
  ['USUARIO', ['/app', '/app/catalog', '/app/reservations']],
  ['OPERADOR', ['/app/loans', '/app/catalog', '/app/registrations']],
  ['ADMINISTRADOR', ['/app/admin/appeals', '/app/admin/users', '/app/admin/catalog']],
]) {
  test(`navegación ${role}: prioridades del rol y selección secundaria reactiva`, async () => {
    const app = await open(role, destinations[0])
    try {
      const nav = findAll(app.root, n => n.props['aria-label'] === 'Accesos principales')[0]
      assert.deepEqual(findAll(nav, n => n.tag === 'a').map(n => n.props.href), destinations)
      const more = () => find(app.root, 'button', 'Más')
      assert.equal(more().props['aria-label'], undefined)
      if (role !== 'USUARIO') {
        await app.router.push('/app/reservations'); await flush()
        assert.equal(more().props['aria-label'], 'Más · Mis reservas y términos, sección actual')
        await app.router.push(destinations[0]); await flush()
        assert.equal(more().props['aria-label'], undefined)
      }
    } finally { app.unmount() }
  })
}
