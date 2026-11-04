import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryHistory, createRouter } from 'vue-router'
import { load, loadComponent, testEnvironment, session } from './helpers/modules.mjs'
import { mount, flush, find, findAll, event, text } from './helpers/renderer.mjs'

const auth = await load('modules/auth/api/auth-api')
const layout = await loadComponent('shared/layouts/AppLayout')
const policy = await load('modules/auth/access-policy')
beforeEach(testEnvironment)
async function open(role, path = '/app') {
  auth.saveSession(session(role))
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push(path)
  await router.isReady()
  return { ...mount(layout, {}, [router]), router }
}

for (const role of ['USUARIO', 'OPERADOR', 'ADMINISTRADOR']) {
  test(`menú ${role}: grupos exactos, sin duplicados y todos los destinos autorizados`, () => {
    const groups = policy.navigationGroups(role)
    assert.deepEqual(groups.map(group => group.label), role === 'ADMINISTRADOR' ? ['Operaciones', 'Administración', 'Personal'] : ['Operaciones', 'Personal'])
    const links = groups.flatMap(group => group.links)
    assert.equal(new Set(links.map(link => link.to)).size, links.length)
    assert.equal(links.filter(link => link.label === 'Inventario').length, role === 'ADMINISTRADOR' ? 1 : 0)
    assert.equal(links.filter(link => link.label === 'Categorías').length, 0)
    assert.deepEqual(groups.at(-1).links.map(link => link.to), ['/app/history', '/app/personal', '/app/terms'])
    for (const link of links) assert.equal(policy.canAccess(link.to, role), true, link.to)
    for (const path of ['/app/admin/inventory', '/app/admin/inventory/categories', '/app/admin/catalog', '/app/admin/users', '/app/admin/appeals', '/app/admin/settings'])
      assert.equal(policy.canAccess(path, role), role === 'ADMINISTRADOR', path)
    assert.equal(policy.canAccess('/app/loans', role), role !== 'USUARIO')
    assert.equal(policy.canAccess('/app/registrations', role), role !== 'USUARIO')
    assert.equal(policy.canAccess('/app/reservations', role), true)
    assert.equal(policy.canAccess('/app/admin/inventory/unknown', role), false)
  })
}

test('administrador hereda todos los destinos de operador y subruta categorías selecciona Inventario', async () => {
  const operator = policy.navigationGroups('OPERADOR').flatMap(group => group.links).map(link => link.to)
  const admin = policy.navigationGroups('ADMINISTRADOR').flatMap(group => group.links).map(link => link.to)
  for (const destination of operator) assert.ok(admin.includes(destination))
  const app = await open('ADMINISTRADOR', '/app/admin/inventory/categories')
  try {
    const nav = findAll(app.root, n => n.props.id === 'app-navigation')[0]
    assert.equal(find(nav, 'a', 'Inventario').props['aria-current'], 'location')
    assert.equal(find(nav, 'a', 'Catálogo').props['aria-current'], undefined)
    assert.equal(find(app.root, 'button', 'Más').props['aria-label'], 'Más · Inventario, sección actual')
    await event(find(app.root, 'button', 'Más'), 'click')
    await app.router.push('/app/history'); await flush()
    assert.equal(find(app.root, 'button', 'Más').props['aria-expanded'], false)
  } finally { app.unmount() }
})

for (const [role, count] of [['USUARIO', 5], ['OPERADOR', 7], ['ADMINISTRADOR', 11]]) {
  test(`layout ${role}: Más conserva destinos y Salir elimina la sesión real`, async () => {
    const app = await open(role)
    try {
      const nav = findAll(app.root, n => n.props.id === 'app-navigation')[0]
      assert.equal(findAll(nav, n => n.tag === 'a').length, count)
      assert.equal(find(nav, 'a', 'Mis reservas y préstamos').props.href, '/app/history')
      assert.equal(findAll(nav, n => n.tag === 'a').at(-1).props.href, '/app/terms')
      await event(find(app.root, 'button', 'Más'), 'click')
      assert.equal(findAll(app.root, n => n.props.class === 'content-shell')[0].props.inert, true)
      await event(findAll(app.root, n => n.props['aria-label'] === 'Cerrar navegación')[0], 'click')
      assert.equal(find(app.root, 'button', 'Más').props['aria-expanded'], false)
      assert.equal(findAll(app.root, n => n.props.class === 'content-shell')[0].props.inert, undefined)
      await event(findAll(app.root, n => n.tag === 'button' && n.props['aria-label'] === 'Cerrar sesión')[0], 'click')
      await flush()
      assert.equal(auth.getSession(), null)
      assert.equal(app.router.currentRoute.value.path, '/login')
    } finally { app.unmount() }
  })
}

test('detalle mantiene Catálogo seleccionado sin marcar Inicio; la cabecera no duplica el buscador', async () => {
  const app = await open('USUARIO', '/app/catalog/resource-test')
  try {
    const nav = findAll(app.root, n => n.props.id === 'app-navigation')[0]
    const catalog = find(nav, 'a', 'Catálogo')
    assert.equal(catalog.props['aria-current'], 'location')
    assert.equal(find(nav, 'a', 'Inicio').props['aria-current'], undefined)
    assert.equal(findAll(app.root, n => n.tag === 'form').length, 0)
    assert.equal(findAll(app.root, n => n.props.id === 'app-header-search').length, 0)
  } finally { app.unmount() }
})

for (const [role, destinations] of [
  ['USUARIO', ['/app', '/app/catalog', '/app/history']],
  ['OPERADOR', ['/app', '/app/catalog', '/app/loans']],
  ['ADMINISTRADOR', ['/app', '/app/catalog', '/app/loans']],
]) {
  test(`navegación ${role}: prioridades del rol y selección secundaria reactiva`, async () => {
    const app = await open(role, destinations[0])
    try {
      const nav = findAll(app.root, n => n.props['aria-label'] === 'Accesos principales')[0]
      assert.deepEqual(findAll(nav, n => n.tag === 'a').map(n => n.props.href), destinations)
      const more = () => find(app.root, 'button', 'Más')
      assert.equal(more().props['aria-label'], undefined)
      if (role !== 'USUARIO') {
        await app.router.push('/app/terms'); await flush()
        assert.equal(more().props['aria-label'], 'Más · Mis términos, sección actual')
        await app.router.push(destinations[0]); await flush()
        assert.equal(more().props['aria-label'], undefined)
      }
    } finally { app.unmount() }
  })
}
