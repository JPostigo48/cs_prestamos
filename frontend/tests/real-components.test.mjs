import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

// Compila las plantillas reales con el mismo lenguaje TypeScript; no monta DOM ni usa red.
async function collect(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
    if (entry.isDirectory()) files.push(...await collect(url))
    else if (entry.name.endsWith('.vue')) files.push(url)
  }
  return files
}
for (const directory of ['modules/auth', 'modules/users', 'modules/inventory', 'modules/loans', 'modules/trust', 'shared']) {
  for (const file of await collect(new URL('../src/' + directory + '/', import.meta.url))) {
    test('componente real compilable: ' + file.pathname.split('/src/')[1], async () => {
      const source = await readFile(file, 'utf8')
      const { descriptor, errors } = parse(source, { filename: file.pathname, templateParseOptions: { expressionPlugins: ['typescript'] } })
      assert.deepEqual(errors, [])
      if (descriptor.script || descriptor.scriptSetup) {
        const script = compileScript(descriptor, { id: file.pathname, inlineTemplate: true, templateOptions: { compilerOptions: { expressionPlugins: ['typescript'] } } })
        assert.ok(script.content)
      } else if (descriptor.template) {
        const template = compileTemplate({ id: file.pathname, filename: file.pathname, source: descriptor.template.content, compilerOptions: { expressionPlugins: ['typescript'] } })
        assert.deepEqual(template.errors, [])
      }
    })
  }
}
