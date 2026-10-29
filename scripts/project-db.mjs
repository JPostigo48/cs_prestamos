// Parser documental del contrato Prisma Next. No importa Prisma ni carga entorno.
// Cada token debe consumirse; las ampliaciones del dialecto fallan explícitamente.
export function parseContract(source) {
  const tokens = []
  let i = 0
  let module = 'Sin módulo'
  const fail = (message, at = i) => { throw new Error(`Contrato ORM, línea ${source.slice(0, at).split('\n').length}: ${message}`) }
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue }
    if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i)
      const comment = source.slice(i + 2, end < 0 ? source.length : end).trim()
      if (/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,]+$/.test(comment)) module = comment
      i = end < 0 ? source.length : end
      continue
    }
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2)
      if (end < 0) fail('comentario sin cerrar')
      i = end + 2
      continue
    }
    const start = i
    const match = source.slice(i).match(/^(?:"(?:\\.|[^"\\])*"|[A-Za-z_][\w]*|-?\d+(?:\.\d+)?|@@?|[{}()[\],:.?])/)
    if (!match) fail('token no soportado')
    i += match[0].length
    tokens.push({ value: match[0], start, end: i, module })
  }
  let cursor = 0
  const peek = () => tokens[cursor]?.value
  const take = () => {
    const token = tokens[cursor++]
    if (!token) fail('fin inesperado', source.length)
    return token
  }
  const expect = value => { const token = take(); if (token.value !== value) fail(`se esperaba ${value}`, token.start); return token }
  const identifier = () => { const token = take(); if (!/^[A-Za-z_]\w*$/.test(token.value)) fail('identificador esperado', token.start); return token.value }
  const value = () => {
    const token = take()
    if (token.value === '[') {
      const result = []
      while (peek() !== ']') { result.push(value()); if (peek() !== ']') expect(',') }
      expect(']')
      return result
    }
    if (token.value.startsWith('"')) {
      try { return JSON.parse(token.value) } catch { fail('literal inválido', token.start) }
    }
    if (!/^(?:[A-Za-z_]\w*|-?\d+(?:\.\d+)?)$/.test(token.value)) fail('valor no soportado', token.start)
    if (peek() === '(') { args(); return source.slice(token.start, tokens[cursor - 1].end) }
    return token.value
  }
  const args = () => {
    expect('(')
    const positional = []
    const named = {}
    while (peek() !== ')') {
      if (tokens[cursor + 1]?.value === ':') {
        const key = identifier(); expect(':')
        if (Object.hasOwn(named, key)) fail(`argumento duplicado: ${key}`)
        named[key] = value()
      } else positional.push(value())
      if (peek() !== ')') expect(',')
    }
    expect(')')
    return { positional, named }
  }
  const attributes = (prefix, allowed) => {
    const result = []
    while (peek() === prefix) {
      const start = take().start
      const name = identifier()
      if (!allowed.includes(name)) fail(`atributo no soportado: ${prefix}${name}`, start)
      const parsed = peek() === '(' ? args() : { positional: [], named: {} }
      result.push({ name, ...parsed, raw: source.slice(start, tokens[cursor - 1].end) })
    }
    return result
  }
  const models = [], enums = []
  const names = new Set()
  while (cursor < tokens.length) {
    const start = take()
    if (!['model', 'enum'].includes(start.value)) fail('solo se admiten modelos y enums; no datasource/generator/SQL', start.start)
    const name = identifier()
    if (names.has(name)) fail(`nombre duplicado: ${name}`, start.start)
    names.add(name)
    expect('{')
    const entity = { name, module: start.module, fields: [], values: [], attributes: [] }
    while (peek() !== '}') {
      if (peek() === '@@') {
        entity.attributes.push(...attributes('@@', start.value === 'enum' ? ['type', 'map'] : ['id', 'unique', 'index', 'check', 'map']))
        continue
      }
      const fieldName = identifier()
      const collection = start.value === 'enum' ? entity.values : entity.fields
      if (collection.some(field => field.name === fieldName)) fail(`campo/valor duplicado: ${name}.${fieldName}`)
      if (start.value === 'enum') {
        collection.push({ name: fieldName, attributes: attributes('@', ['map']) })
        continue
      }
      const typeStart = tokens[cursor]?.start
      let type = identifier()
      if (peek() === '.') { expect('.'); type += `.${identifier()}` }
      if (peek() === '(') args()
      const typeExpression = source.slice(typeStart, tokens[cursor - 1].end)
      let nullable = false, list = false
      if (peek() === '?') { take(); nullable = true }
      else if (peek() === '[') { take(); expect(']'); list = true }
      collection.push({ name: fieldName, type, typeExpression, nullable, list, attributes: attributes('@', ['id', 'unique', 'default', 'map', 'relation', 'updatedAt']) })
    }
    expect('}')
    if (start.value === 'model') { delete entity.values; models.push(entity) }
    else { delete entity.fields; enums.push(entity) }
  }
  const modelMap = new Map(models.map(model => [model.name, model]))
  const enumNames = new Set(enums.map(item => item.name))
  const scalarTypes = new Set(['Uuid', 'String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Jsonb', 'Bytes', 'VarChar', 'Char', 'Text', 'Numeric', 'Timestamptz', 'Timestamp', 'Date', 'Time', 'temporal.updatedAt'])
  const attr = (field, name) => field.attributes.find(item => item.name === name)
  const cardinality = field => field.list ? '0..n' : field.nullable ? '0..1' : '1'
  const relations = []
  for (const model of models) {
    for (const constraint of model.attributes.filter(a => ['id', 'unique', 'index'].includes(a.name))) {
      if (!Array.isArray(constraint.positional[0]) || constraint.positional[0].some(key => !model.fields.some(f => f.name === key))) fail(`campos inválidos en ${model.name} ${constraint.raw}`)
    }
    for (const field of model.fields) {
      field.kind = modelMap.has(field.type) ? 'relation' : enumNames.has(field.type) ? 'enum' : 'scalar'
      if (field.kind === 'scalar' && !scalarTypes.has(field.type)) fail(`tipo no soportado: ${model.name}.${field.name} ${field.type}`)
      if (field.kind !== 'relation') {
        if (attr(field, 'relation')) fail(`relación con tipo desconocido: ${model.name}.${field.name}`)
        continue
      }
      const target = modelMap.get(field.type)
      const declaration = attr(field, 'relation')
      const relationName = declaration?.positional[0] ?? null
      const inverse = target.fields.filter(other => other.type === model.name && (attr(other, 'relation')?.positional[0] ?? null) === relationName && !(target === model && other === field))
      if (inverse.length !== 1) fail(`relación inversa ambigua o ausente: ${model.name}.${field.name}`)
      const owner = declaration?.named.fields ? field : inverse[0]
      const ownerModel = owner === field ? model : target
      const referenceModel = owner === field ? target : model
      const ownership = attr(owner, 'relation')?.named
      if (!Array.isArray(ownership?.fields) || !Array.isArray(ownership?.references) || ownership.fields.length !== ownership.references.length || !ownership.fields.length) fail(`FK no soportada: ${model.name}.${field.name}`)
      if (ownership.fields.some(key => !ownerModel.fields.some(f => f.name === key)) || ownership.references.some(key => !referenceModel.fields.some(f => f.name === key))) fail(`referencia inexistente: ${model.name}.${field.name}`)
      relations.push({ source: model.name, field: field.name, target: target.name, inverse: inverse[0].name, name: relationName, direction: owner === field ? 'outgoing' : 'incoming', sourceCardinality: cardinality(inverse[0]), targetCardinality: cardinality(field), owner: ownerModel.name, fields: ownership.fields, references: ownership.references, onDelete: ownership.onDelete ?? null, onUpdate: ownership.onUpdate ?? null })
    }
  }
  return { source: 'backend/prisma/contract.prisma', models, enums, relations }
}
