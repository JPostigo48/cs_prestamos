import type { AccessRole } from './api/auth-api'

export const isStaff = (role: AccessRole): boolean =>
  role === 'OPERADOR' || role === 'ADMINISTRADOR'
export const homeFor = (role: AccessRole): string =>
  role === 'ADMINISTRADOR' ? '/app/admin/appeals' : role === 'OPERADOR' ? '/app/loans' : '/app'

export function canAccess(path: string, role: AccessRole): boolean {
  if (path === '/app') return role === 'USUARIO'
  if (path === '/app/loans') return isStaff(role)
  if (path === '/app/reservations') return true
  if (path === '/app/registrations') return isStaff(role)
  if (/^\/app\/admin\/(appeals|users|catalog)$/.test(path)) return role === 'ADMINISTRADOR'
  return path === '/app/denied' || path === '/app/catalog' || /^\/app\/catalog\/[^/]+$/.test(path)
}

export function safeDestination(value: unknown, role: AccessRole): string {
  if (typeof value !== 'string' || !value.startsWith('/app') || /[\\\u0000-\u0020]/.test(value))
    return homeFor(role)
  try {
    const url = new URL(value, 'https://local.invalid')
    if (
      url.origin === 'https://local.invalid' &&
      canAccess(url.pathname, role) &&
      url.pathname !== '/app/denied'
    ) {
      return url.pathname + url.search + url.hash
    }
  } catch {
    /* Un destino no válido nunca se usa para navegar. */
  }
  return homeFor(role)
}
