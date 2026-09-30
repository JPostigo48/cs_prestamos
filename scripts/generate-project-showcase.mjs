import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'frontend/public/generated/project')
const diagramOutput = join(output, 'diagrams')
mkdirSync(diagramOutput, { recursive: true })

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function sourcePath(path) {
  return relative(root, path).replaceAll('\\', '/')
}

function frontMatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  return Object.fromEntries(match[1].split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf(':')
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
  }))
}

function section(markdown, heading) {
  const normalized = markdown.replaceAll('\r\n', '\n')
  const start = normalized.indexOf(`${heading}\n`)
  if (start < 0) return ''
  const body = normalized.slice(start + heading.length + 1)
  const next = body.search(/^## /m)
  return (next < 0 ? body : body.slice(0, next)).trim()
}

function plain(value) {
  return value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*`]/g, '').trim()
}

function table(markdown) {
  return markdown.split(/\r?\n/)
    .filter((line) => line.startsWith('|') && !/^\|[\s:|-]+\|?$/.test(line))
    .slice(1)
    .map((line) => line.slice(1, -1).split('|').map((cell) => plain(cell)))
}

function firstParagraph(markdown) {
  return plain(markdown.split(/\r?\n\s*\r?\n/)[0] ?? '').replace(/\s+/g, ' ')
}

function json(name, value) {
  writeFileSync(join(output, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const projectReadme = read('README.md')
const technologies = table(section(projectReadme, '## Tecnologías'))
  .map(([area, technology]) => ({ area, technology }))

const sprintDirectory = join(root, 'docs/planning/sprints')
const sprints = readdirSync(sprintDirectory)
  .filter((name) => /^sprint-\d\d\.md$/.test(name))
  .sort()
  .map((name) => {
    const path = join(sprintDirectory, name)
    const markdown = readFileSync(path, 'utf8')
    const meta = frontMatter(markdown)
    const result = firstParagraph(section(markdown, '## Resultado del sprint'))
    return {
      sprint: Number(meta.sprint),
      name: meta.name,
      status: meta.status,
      version: meta.version,
      objective: firstParagraph(section(markdown, '## Objetivo')),
      result: result === 'Pendiente.' ? '' : result,
      members: table(section(markdown, '## Integrantes y responsabilidades'))
        .map(([member, responsibility, branch = '']) => ({ name: member, responsibility, branch })),
      planIds: [...new Set(markdown.match(/PLAN-\d\d/g) ?? [])],
      source: sourcePath(path),
    }
  })

json('planning.json', {
  project: plain(projectReadme.match(/^# (.+)$/m)?.[1] ?? 'Sistema de gestión de préstamos universitarios'),
  technologies,
  sprints,
})

const backlog = read('docs/planning/backlog.md')
  .split(/\r?\n/)
  .filter((line) => /^\| [A-Z]+-\d\d \|/.test(line))
  .map((line) => {
    const [id, description, module, owner, priority, sprint, version, status] = line.slice(1, -1).split('|').map(plain)
    return { id, description, module, owner, priority, sprint, version, status }
  })
json('backlog.json', backlog)

const workflow = read('docs/planning/git-workflow.md')
json('git.json', {
  branchTypes: table(section(workflow, '## Ramas temporales')).map(([prefix, purpose]) => ({ prefix, purpose })),
  versions: table(section(workflow, '## Versión objetivo por sprint'))
    .map(([sprint, version, prefix]) => ({ sprint, version, prefix })),
  source: 'docs/planning/git-workflow.md',
})

const progressDirectory = join(root, 'docs/planning/progress')
const weeks = existsSync(progressDirectory)
  ? readdirSync(progressDirectory).filter((name) => /^week-\d\d\.md$/.test(name)).sort().map((name) => {
    const path = join(progressDirectory, name)
    const markdown = readFileSync(path, 'utf8')
    const meta = frontMatter(markdown)
    const members = [...markdown.matchAll(/^## (.+)$/gm)].map((match, index, headings) => {
      const bodyStart = match.index + match[0].length
      const bodyEnd = headings[index + 1]?.index ?? markdown.length
      const body = markdown.slice(bodyStart, bodyEnd)
      const items = (title) => {
        const start = body.indexOf(`### ${title}`)
        if (start < 0) return []
        const after = body.slice(start + title.length + 4)
        const end = after.search(/^### /m)
        return (end < 0 ? after : after.slice(0, end)).split(/\r?\n/)
          .filter((line) => line.startsWith('- ')).map((line) => plain(line.slice(2)))
      }
      return {
        name: match[1].trim(),
        planned: items('Planificado'),
        done: items('Realizado'),
        pending: items('Pendiente'),
        blockers: items('Bloqueos'),
      }
    })
    return {
      week: Number(meta.week),
      sprint: Number(meta.sprint),
      start: meta.start,
      end: meta.end,
      status: meta.status,
      members,
      source: sourcePath(path),
    }
  })
  : []
json('team-progress.json', weeks)

const diagrams = [
  { title: 'Modelo de dominio', source: 'docs/architecture/uml/modelo-dominio.puml', file: 'modelo-dominio.svg', type: 'Dominio' },
  { title: 'Arquitectura modular por capas', source: 'docs/architecture/uml/arquitectura-modular.puml', file: 'arquitectura-modular.svg', type: 'Arquitectura' },
]

const structurizrSource = 'docs/architecture/structurizr/workspace.dsl'
const structurizrViews = [
  ['MapaContextosDDD', 'Mapa de contextos DDD', 'mapa-contextos-ddd.svg'],
  ['InteraccionContextosDDD', 'Interacción entre contextos', 'interaccion-contextos-ddd.svg'],
  ['InternaPrestamos', 'Préstamos — vista interna', 'interna-prestamos.svg'],
  ['InternaInventario', 'Inventario — vista interna', 'interna-inventario.svg'],
  ['InternaUsuarios', 'Usuarios — vista interna', 'interna-usuarios.svg'],
  ['InternaReglasTerminos', 'Reglas y términos — vista interna', 'interna-reglas-terminos.svg'],
  ['InternaConfianza', 'Confianza — vista interna', 'interna-confianza.svg'],
  ['InternaAutenticacion', 'Autenticación — vista interna', 'interna-autenticacion.svg'],
]

function renderPlantUml(source, destination) {
  const svg = execFileSync('java', ['-jar', process.env.PLANTUML_JAR, '-charset', 'UTF-8', '-tsvg', '-pipe'], {
    input: source,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (!svg.includes('<svg') || /Syntax Error|Error line/i.test(svg)) {
    throw new Error(`PlantUML no generó un SVG válido: ${destination}`)
  }
  writeFileSync(join(diagramOutput, destination), svg, 'utf8')
}

if (process.env.PLANTUML_JAR) {
  for (const diagram of diagrams) renderPlantUml(read(diagram.source), diagram.file)
}

if (process.env.STRUCTURIZR_JAR) {
  if (!process.env.PLANTUML_JAR) throw new Error('La exportación de Structurizr requiere PLANTUML_JAR')
  const temporary = mkdtempSync(join(tmpdir(), 'project-showcase-structurizr-'))
  try {
    execFileSync('java', [
      '-jar', process.env.STRUCTURIZR_JAR,
      'export', '-workspace', join(root, structurizrSource),
      '-format', 'plantuml', '-output', temporary,
    ], { stdio: 'pipe' })
    for (const [key, title, file] of structurizrViews) {
      const exported = readdirSync(temporary).find((name) => name.endsWith(`_${key}.puml`))
      if (!exported) throw new Error(`No se exportó la vista ${title}`)
      renderPlantUml(readFileSync(join(temporary, exported), 'utf8'), file)
    }
  } finally {
    if (resolve(temporary).startsWith(`${resolve(tmpdir())}${sep}`)) rmSync(temporary, { recursive: true, force: true })
  }
}

json('architecture.json', {
  diagrams: [...diagrams, ...structurizrViews.map(([, title, file]) => ({
    title, source: structurizrSource, file, type: 'Contextos',
  }))].map(({ title, source, file, type }) => ({
    title,
    source,
    image: existsSync(join(diagramOutput, file)) ? `/generated/project/diagrams/${file}` : null,
    type,
  })),
  structurizr: structurizrSource,
})

const openApiSource = join(root, 'backend/openapi.json')
if (existsSync(openApiSource)) {
  writeFileSync(join(output, 'openapi.json'), readFileSync(openApiSource))
}

process.stdout.write(`Project Showcase: ${sprints.length} sprints, ${backlog.length} tareas y ${weeks.length} semanas.\n`)
