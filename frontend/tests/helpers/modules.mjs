import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
const cache = new Map()
async function moduleUrl(url) {
  if (cache.has(url.href)) return cache.get(url.href)
  let source = await readFile(url, 'utf8')
  if (url.pathname.endsWith('.vue')) {
    const { descriptor } = parse(source, { filename: url.pathname, templateParseOptions: { expressionPlugins: ['typescript'] } })
    source = compileScript(descriptor, { id: url.pathname, inlineTemplate: true, templateOptions: { compilerOptions: { expressionPlugins: ['typescript'] } } }).content
  }
  let code = ts
    .transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    .outputText.replaceAll('import.meta.env', '({})')
  for (const match of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]) {
    const dependency = match[1].startsWith('.')
      ? await moduleUrl(new URL(match[1] + (match[1].endsWith('.vue') ? '' : '.ts'), url))
      : import.meta.resolve(match[1])
    code = code.replace(match[0], 'from ' + JSON.stringify(dependency))
  }
  const result = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  cache.set(url.href, result)
  return result
}
export const load = async (path) =>
  import(await moduleUrl(new URL('../../src/' + path + '.ts', import.meta.url)))
export const loadComponent = async (path) =>
  (await import(await moduleUrl(new URL('../../src/' + path + '.vue', import.meta.url)))).default
export function testEnvironment() {
  const values = new Map()
  globalThis.sessionStorage = {
    get length() { return values.size },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  globalThis.window = new EventTarget()
  globalThis.fetch = async (url) => {
    throw new Error('Petición de test inesperada: ' + url)
  }
  return values
}
export const session = (role = 'USUARIO') => ({
  accessToken: 'offline-test-token',
  tokenType: 'Bearer',
  expiresAt: Date.now() + 60000,
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'test@example.invalid',
    role,
    userType: 'DOCENTE',
  },
})
