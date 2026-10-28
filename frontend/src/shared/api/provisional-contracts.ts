import { ApiError, apiRequest } from './client'
import { authenticatedRequest } from '../../modules/auth/api/auth-api'
import { validPeriod } from './calendar'

// Propuestas AUSENTES del backend. No hay fallback, polling ni reintentos.
export const provisionalContracts = {
  F01: {
    method: 'POST',
    path: '/auth/google/authorization',
    roles: 'Público',
    screen: '/login/google',
    request: 'email',
    response: 'authorizationUrl HTTPS Google',
  },
  F02: {
    method: 'GET',
    path: '/terms/current',
    roles: 'Público',
    screen: '/register y reservas',
    request: '—',
    response: 'id, number, title, content',
  },
  F03: {
    method: 'POST',
    path: '/auth/registration-requests',
    roles: 'Público',
    screen: '/register',
    request: 'name,email,password,userType,institutionalId?,evidence,termsVersionId',
    response: 'id,status=PENDIENTE',
  },
  F04: {
    method: 'GET',
    path: '/appeals',
    roles: 'Titular / ADMINISTRADOR',
    screen: 'Inicio / apelaciones',
    request: 'userId? o status?',
    response: 'items Apelación,total',
  },
  F05: {
    method: 'GET',
    path: '/sanctions/:sanctionId',
    roles: 'Titular / personal',
    screen: 'Inicio / historial',
    request: 'sanctionId',
    response: 'id,status,startsAt,endsAt,motivo?; detalles opcionales',
  },
  F06: {
    method: 'GET',
    path: '/inventory/resources/:resourceId/accessories',
    roles: 'Autenticado',
    screen: 'Detalle / recepción',
    request: 'resourceId',
    response: 'items {id,nombre}',
  },
  F07: {
    method: 'PUT',
    path: '/inventory/resources/:resourceId/accessories',
    roles: 'ADMINISTRADOR',
    screen: 'Editor de recurso',
    request: 'items {id?,nombre}',
    response: 'items {id,nombre}',
  },
  F08: {
    method: 'GET',
    path: '/loans/resource/:resourceId/history',
    roles: 'Personal',
    screen: 'Detalle',
    request: 'resourceId',
    response: 'items Préstamo',
  },
  F09: {
    method: 'POST',
    path: '/loans/:loanId/return-checklist',
    roles: 'Personal',
    screen: 'Recepción',
    request: 'parts {accessoryId,received},checkedAt',
    response: 'id,loanId,parts,checkedAt',
  },
  F10: {
    method: 'GET',
    path: '/auth/accounts',
    roles: 'ADMINISTRADOR',
    screen: 'Usuarios',
    request: 'userId',
    response: 'items Cuenta segura',
  },
  F11: {
    method: 'POST',
    path: '/users/:userId/suspensions',
    roles: 'ADMINISTRADOR',
    screen: 'Usuarios',
    request: 'reason,startsAt,endsAt nullable',
    response: 'id,userId,status,startsAt,endsAt',
  },
  F12: {
    method: 'POST',
    path: '/sanctions/:sanctionId/lift',
    roles: 'ADMINISTRADOR',
    screen: 'Usuarios / sanciones',
    request: 'resolution',
    response: 'id,status FINALIZADA o ABSUELTA',
  },
  F13: {
    method: 'PATCH',
    path: '/inventory/resources/:resourceId/loan-policy',
    roles: 'ADMINISTRADOR',
    screen: 'Editor de recurso',
    request: 'durationHours',
    response: 'resourceId,durationHours',
  },
  F14: {
    method: 'GET',
    path: '/loans/reservations',
    roles: 'Titular / personal',
    screen: 'Reservas / entregas',
    request: 'userId? o status?',
    response: 'items Reserva,total',
  },
} as const
export type ProvisionalId = keyof typeof provisionalContracts
export type JsonObject = Record<string, unknown>
export const object = (v: unknown): v is JsonObject =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim()
const items = (v: unknown, valid: (item: JsonObject) => boolean) =>
  object(v) && Array.isArray(v.items) && v.items.every((item) => object(item) && valid(item))
const loan = (v: JsonObject) =>
  text(v.id) &&
  text(v.copyId) &&
  text(v.userId) &&
  text(v.endsAt) &&
  ['ACTIVO', 'FINALIZADO', 'PLANIFICADO'].includes(String(v.status))
const accessory = (v: JsonObject) => text(v.id) && text(v.nombre)
export function validProvisional(id: ProvisionalId, v: unknown): boolean {
  if (!object(v)) return false
  switch (id) {
    case 'F01': {
      try {
        const url = new URL(String(v.authorizationUrl))
        return (
          url.protocol === 'https:' &&
          url.hostname === 'accounts.google.com' &&
          url.username === '' &&
          url.password === ''
        )
      } catch {
        return false
      }
    }
    case 'F02':
      return (
        text(v.id) &&
        Number.isInteger(v.number) &&
        Number(v.number) > 0 &&
        text(v.title) &&
        text(v.content)
      )
    case 'F03':
      return text(v.id) && v.status === 'PENDIENTE'
    case 'F04':
      return (
        items(
          v,
          (a) =>
            text(a.id) &&
            text(a.userId) &&
            text(a.reason) &&
            text(a.submittedAt) && Number.isFinite(new Date(a.submittedAt).getTime()) &&
            ['PENDIENTE', 'ACEPTADA', 'RECHAZADA'].includes(String(a.status)),
        ) && Number.isInteger(v.total)
      )
    case 'F12':
      return text(v.id) && ['FINALIZADA', 'ABSUELTA'].includes(String(v.status))
    case 'F05':
      return (
        text(v.id) && ['PROGRAMADA', 'ACTIVA', 'FINALIZADA', 'ABSUELTA'].includes(String(v.status))
      )
    case 'F06':
    case 'F07':
      return items(v, accessory)
    case 'F08':
      return items(v, loan)
    case 'F09':
      return (
        text(v.id) &&
        text(v.loanId) &&
        text(v.checkedAt) &&
        Array.isArray(v.parts) &&
        v.parts.every((p) => object(p) && text(p.accessoryId) && typeof p.received === 'boolean')
      )
    case 'F10':
      return items(
        v,
        (a) =>
          text(a.id) &&
          text(a.userId) &&
          text(a.email) &&
          typeof a.enabled === 'boolean' &&
          ['USUARIO', 'OPERADOR', 'ADMINISTRADOR'].includes(String(a.role)),
      )
    case 'F11':
      return (
        text(v.id) &&
        text(v.userId) &&
        ['ACTIVA', 'PROGRAMADA'].includes(String(v.status)) &&
        validPeriod(v.startsAt, v.endsAt)
      )
    case 'F13':
      return text(v.resourceId) && Number.isInteger(v.durationHours) && Number(v.durationHours) > 0
    case 'F14':
      return (
        items(
          v,
          (r) =>
            text(r.id) &&
            text(r.userId) &&
            text(r.copyId) &&
            text(r.requestedAt) &&
            text(r.pickupDeadline) &&
            ['CONFIRMADA', 'RECOGIDA', 'CANCELADA', 'VENCIDA'].includes(String(r.status)),
        ) && Number.isInteger(v.total)
      )
  }
}
export async function provisionalRequest<T>(
  id: ProvisionalId,
  options: {
    params?: Record<string, string>
    query?: Record<string, string>
    body?: unknown
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const contract = provisionalContracts[id]
  let path: string = contract.path
  for (const [key, value] of Object.entries(options.params ?? {}))
    path = path.replace(':' + key, encodeURIComponent(value))
  if (/:\w+/.test(path)) throw new ApiError('Falta un parámetro del contrato.', 400)
  if (options.query) path += '?' + new URLSearchParams(options.query)
  try {
    const request = ['F01', 'F02', 'F03'].includes(id) ? apiRequest : authenticatedRequest
    const result = await request<unknown>(path, {
      method: contract.method,
      body: options.body,
      signal: options.signal,
    })
    if (!validProvisional(id, result))
      throw new ApiError('Respuesta incompatible con el contrato propuesto.', 0)
    if (id === 'F05' && object(result) && result.id !== options.params?.sanctionId)
      throw new ApiError('El detalle recibido corresponde a otra sanción.', 0)
    return result as T
  } catch (cause) {
    if (cause instanceof ApiError)
      throw new ApiError(
        `${id} · Contrato provisional pendiente · ${cause.status ? 'HTTP ' + cause.status : 'Red o contrato inválido'}: ${cause.message}`,
        cause.status,
      )
    throw cause
  }
}
