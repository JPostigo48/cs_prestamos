import type { AccessRole } from './api/auth-api'

export const isStaff = (role: AccessRole): boolean =>
  role === 'OPERADOR' || role === 'ADMINISTRADOR'
export const homeFor = (role: AccessRole): string =>
  role === 'ADMINISTRADOR' ? '/app/admin/appeals' : role === 'OPERADOR' ? '/app/loans' : '/app'

export function navigationGroups(role: AccessRole) {
  return [
    { label: 'Operaciones', links: [
      { to: '/app', label: 'Inicio', short: 'Inicio', icon: 'home' },
      { to: '/app/catalog', label: 'Catálogo', short: 'Catálogo', icon: 'catalog' },
      ...(isStaff(role) ? [
        { to: '/app/loans', label: 'Préstamos y devoluciones', short: 'Préstamos', icon: 'loans' },
        { to: '/app/registrations', label: 'Solicitudes de registro', short: 'Solicitudes', icon: 'requests' },
      ] : []),
    ] },
    ...(role === 'ADMINISTRADOR' ? [{ label: 'Administración', links: [
      { to: '/app/admin/users', label: 'Usuarios y cuentas', short: 'Usuarios', icon: 'users' },
      { to: '/app/admin/inventory', label: 'Inventario', short: 'Inventario', icon: 'inventory' },
      { to: '/app/admin/appeals', label: 'Apelaciones y sanciones', short: 'Apelaciones', icon: 'appeals' },
      { to: '/app/admin/settings', label: 'Configuración del sistema', short: 'Configuración', icon: 'settings' },
    ] }] : []),
    { label: 'Personal', links: [
      { to: '/app/history', label: 'Mis reservas y préstamos', short: 'Mis préstamos', icon: 'history' },
      { to: '/app/personal', label: 'Mi confianza y sanciones', short: 'Mi confianza', icon: 'appeals' },
      { to: '/app/terms', label: 'Mis términos', short: 'Términos', icon: 'terms' },
    ] },
  ]
}

export const navigationIsCurrent = (path: string, to: string) => path === to ||
  ((to === '/app/catalog' || to === '/app/admin/inventory') && path.startsWith(to + '/'))

export function canAccess(path: string, role: AccessRole): boolean {
  if (['/app', '/app/personal', '/app/history', '/app/terms', '/app/reservations'].includes(path)) return true
  if (path === '/app/loans') return isStaff(role)
  if (path === '/app/registrations') return isStaff(role)
  if (/^\/app\/admin\/inventory(?:\/categories)?$/.test(path)) return role === 'ADMINISTRADOR'
  if (/^\/app\/admin\/(appeals|users|catalog|settings)$/.test(path)) return role === 'ADMINISTRADOR'
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
