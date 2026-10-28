import { createRenderer, h, nextTick } from 'vue'

// Host en memoria: ejecuta render, directivas, eventos y ciclo Vue. NO simula CSS/layout/browser.
class HostNode {
  constructor(tag, text = '') { this.tag = tag; this.text = text; this.children = []; this.props = {}; this.listeners = {}; this.style = {}; this.parent = null; this.value = ''; this.checked = false }
  get tagName() { return this.tag.toUpperCase() }
  get options() { return this.children.filter(c => c.tag === 'option') }
  get type() { return this.props.type }
  get multiple() { return !!this.props.multiple }
  get isConnected() { return !!this.parent }
  getRootNode() { return document }
  addEventListener(name, handler) { (this.listeners[name] ??= []).push(handler) }
  removeEventListener() {}
  setAttribute(name, value) { this.props[name] = value }
  removeAttribute(name) { delete this.props[name] }
  focus() { document.activeElement = this }
  showModal() { this.open = true }
  close() { this.open = false }
}
const renderer = createRenderer({
  createElement: tag => new HostNode(tag),
  createText: text => new HostNode('#text', text),
  createComment: text => new HostNode('#comment', text),
  setText: (node, text) => { node.text = text },
  setElementText: (node, text) => { node.children = []; node.text = text },
  parentNode: node => node.parent,
  nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  insert(node, parent, anchor = null) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
    node.parent = parent
    const index = parent.children.indexOf(anchor)
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
  },
  remove(node) { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = null },
  patchProp(node, key, _old, value) { node.props[key] = value; if (key === 'value') { node.value = value; node._value = value } if (key === 'checked') node.checked = value },
})
export const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await nextTick() }
export const text = node => node.tag === '#comment' ? '' : node.text + node.children.map(text).join(' ')
export function findAll(node, predicate) { return [...(predicate(node) ? [node] : []), ...node.children.flatMap(c => findAll(c, predicate))] }
export const find = (root, tag, label) => findAll(root, n => n.tag === tag && (!label || text(n).includes(label)))[0]
export async function event(node, name, payload = {}) {
  if (!node) throw new Error('Elemento de prueba no encontrado')
  const e = { target: node, preventDefault() {}, stopPropagation() {}, ...payload }
  const handlers = node.props['on' + name[0].toUpperCase() + name.slice(1)]
  for (const handler of Array.isArray(handlers) ? handlers : handlers ? [handlers] : []) await handler(e)
  await flush()
}
export async function model(node, value) {
  if (!node?.props['onUpdate:modelValue']) throw new Error('Control sin modelo')
  node.props['onUpdate:modelValue'](value)
  await flush()
}
export function mount(component, props = {}, plugins = []) {
  globalThis.HTMLElement = HostNode
  globalThis.Document = class Document {}
  const bodyClasses = new Set()
  globalThis.document = Object.assign(new Document(), { body: { style: {}, classList: { add: value => bodyClasses.add(value), remove: value => bodyClasses.delete(value), contains: value => bodyClasses.has(value) } }, activeElement: null, getElementById: () => null })
  const root = new HostNode('root')
  const app = renderer.createApp({ render: () => h(component, props) })
  // Los enlaces se pueden inspeccionar sin router; los tests de rutas instalan uno real.
  if (!plugins.length) app.component('RouterLink', { props: ['to'], setup: (props, { slots }) => () => h('a', { to: props.to }, slots.default?.()) })
  for (const plugin of plugins) app.use(plugin)
  app.mount(root)
  return { root, unmount: () => app.unmount() }
}
