import type { CatalogFilters } from './api/inventory-api'

export function catalogFilters(query: Record<string, unknown>): CatalogFilters {
  const integer = (value: unknown, fallback: number, max: number) => typeof value === 'string' && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : fallback
  return {
    search: typeof query.search === 'string' ? query.search.slice(0, 120) : '',
    categoryId: typeof query.categoryId === 'string' ? query.categoryId : '',
    available: query.available === 'true' || query.available === 'false' ? query.available : '',
    page: integer(query.page, 1, 1000000), limit: integer(query.limit, 20, 100),
  }
}

// Únicamente destinos internos conocidos; nunca aceptar un returnTo arbitrario.
export function catalogDestination(query: Record<string, unknown>, management = false) {
  const filters: Record<string, string> = {}
  for (const name of ['search', 'categoryId', 'available', 'page', 'limit'])
    if (typeof query[name] === 'string') filters[name] = query[name]
  return { path: management ? '/app/admin/catalog' : '/app/catalog', query: filters }
}
export function resourceDestination(id: string, query: Record<string, unknown>, management = false) {
  return { path: '/app/catalog/' + encodeURIComponent(id), query: { ...catalogDestination(query).query, origin: management ? 'management' : 'catalog' } }
}
