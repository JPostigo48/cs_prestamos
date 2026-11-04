<script setup lang="ts">
import { computed, defineComponent, h, type VNodeChild } from 'vue'

const props = defineProps<{ content: string }>()

// Se crean nodos de Vue: el contenido nunca se interpreta como HTML arbitrario.
function inline(text: string): VNodeChild[] {
  const parts: VNodeChild[] = []
  const pattern = /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)|\*([^*]+)\*/g
  let previous = 0
  for (const match of text.matchAll(pattern)) {
    parts.push(text.slice(previous, match.index))
    if (match[1] || match[2]) parts.push(h('strong', match[1] ?? match[2]))
    else if (match[3]) parts.push(h('code', match[3]))
    else if (match[4]) {
      const target = match[5] ?? ''
      parts.push(/^https?:\/\/|^mailto:/i.test(target)
        ? h('a', { href: target, target: '_blank', rel: 'noopener noreferrer' }, match[4])
        : match[4])
    } else parts.push(h('em', match[6]))
    previous = (match.index ?? 0) + match[0].length
  }
  parts.push(text.slice(previous))
  return parts
}
const tableCells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
const tableSeparator = (line: string) => line.includes('|') && tableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell))
const listItem = (line: string) => line.match(/^\s*(?:([-+*])|\d+[.)])\s+(.+)$/)
function documentNodes(content: string): VNodeChild[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const nodes: VNodeChild[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!.trim()
    if (!line) { index++; continue }
    if (/^```/.test(line)) {
      const code: string[] = []
      index++
      while (index < lines.length && !/^```/.test(lines[index]!.trim())) code.push(lines[index++]!)
      index++
      nodes.push(h('pre', [h('code', code.join('\n'))]))
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/)
    if (heading) {
      nodes.push(h(`h${Math.min(heading[1]!.length + 1, 6)}`, inline(heading[2]!)))
      index++
      continue
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) { nodes.push(h('hr')); index++; continue }
    if (index + 1 < lines.length && line.includes('|') && tableSeparator(lines[index + 1]!)) {
      const headers = tableCells(line)
      const rows: VNodeChild[] = []
      index += 2
      while (index < lines.length && lines[index]!.trim().includes('|') && lines[index]!.trim()) {
        const cells = tableCells(lines[index++]!)
        rows.push(h('tr', headers.map((_, column) => h('td', inline(cells[column] ?? '')))))
      }
      nodes.push(h('div', { class: 'document-table' }, [h('table', [
        h('thead', [h('tr', headers.map((cell) => h('th', { scope: 'col' }, inline(cell))))]),
        h('tbody', rows),
      ])]))
      continue
    }
    const item = listItem(line)
    if (item) {
      const ordered = !item[1]
      const items: VNodeChild[] = []
      while (index < lines.length) {
        const next = listItem(lines[index]!)
        if (!next || (next[1] === undefined) !== ordered) break
        items.push(h('li', inline(next[2]!)))
        index++
      }
      const start = ordered ? Number(line.match(/^\d+/)?.[0] ?? 1) : undefined
      nodes.push(h(ordered ? 'ol' : 'ul', ordered ? { start } : {}, items))
      continue
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index]!.trim())) quote.push(lines[index++]!.trim().replace(/^>\s?/, ''))
      nodes.push(h('blockquote', inline(quote.join(' '))))
      continue
    }
    const paragraph = [line]
    index++
    while (index < lines.length && lines[index]!.trim()) {
      const next = lines[index]!.trim()
      if (/^(?:#{1,6}\s|```|>|-{3,}$|\*{3,}$|_{3,}$)/.test(next) || listItem(next)
        || (next.includes('|') && index + 1 < lines.length && tableSeparator(lines[index + 1]!))) break
      paragraph.push(next)
      index++
    }
    nodes.push(h('p', inline(paragraph.join(' '))))
  }
  return nodes
}
const nodes = computed(() => documentNodes(props.content))
const DocumentBody = defineComponent({ setup: () => () => h('article', { class: 'terms-document' }, nodes.value) })
</script>

<template><div class="terms-document-wrapper"><DocumentBody /></div></template>

<style scoped>
:deep(.terms-document) { color: #334155; font-size: 15px; line-height: 1.85; overflow-wrap: anywhere; }
:deep(.terms-document > :first-child) { margin-top: 0; }
:deep(.terms-document :is(h2, h3, h4, h5, h6)) { color: #17375e; font-weight: 750; line-height: 1.4; margin: 1.8rem 0 .7rem; }
:deep(.terms-document h2) { font-size: 1.3rem; }
:deep(.terms-document h3) { font-size: 1.1rem; }
:deep(.terms-document p) { margin: .8rem 0; }
:deep(.terms-document :is(ul, ol)) { margin: .8rem 0; padding-left: 1.6rem; }
:deep(.terms-document ul) { list-style: disc; }
:deep(.terms-document ol) { list-style: decimal; }
:deep(.terms-document li) { padding-left: .3rem; margin: .45rem 0; }
:deep(.terms-document strong) { color: #1e293b; font-weight: 700; }
:deep(.terms-document a) { color: #1d4ed8; text-decoration: underline; }
:deep(.terms-document blockquote) { margin: 1rem 0; padding: .8rem 1rem; border-left: 3px solid #93c5fd; background: #eff6ff; }
:deep(.terms-document hr) { margin: 1.5rem 0; border: 0; border-top: 1px solid #e2e8f0; }
:deep(.terms-document code) { font-size: .9em; background: #f1f5f9; padding: .1rem .3rem; border-radius: 4px; }
:deep(.terms-document pre) { padding: 1rem; overflow: auto; background: #f1f5f9; border-radius: 8px; }
:deep(.terms-document pre code) { padding: 0; }
:deep(.document-table) { overflow-x: auto; margin: 1rem 0; }
:deep(.terms-document table) { width: 100%; border-collapse: collapse; font-size: 13px; }
:deep(.terms-document :is(th, td)) { text-align: left; padding: .65rem .8rem; border: 1px solid #e2e8f0; vertical-align: top; }
:deep(.terms-document th) { background: #f1f5f9; color: #17375e; font-weight: 700; }
</style>
