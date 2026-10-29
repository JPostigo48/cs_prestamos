import { ApiError } from '../../../shared/api/client'

export interface CopyLoanSnapshot {
  schemaVersion: 1
  copyId: string
  resourceId: string
  policy: {
    resourceId: string
    categoryId: string
    durationHours: number | null
    effectiveDurationHours: number
    source: 'RESOURCE' | 'CATEGORY'
  }
  accessories: { id: string; nombre: string }[]
}
export interface ReturnChecklistCapture {
  id: string
  loanId: string
  actorId: string
  checkedAt: string
  configurationSnapshot: CopyLoanSnapshot | null
  parts: { accessoryId: string; nombre: string; received: boolean }[]
}
export interface Page<T> { items: T[]; total: number; page: number; limit: number }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim()
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
export function validSnapshot(v: unknown): v is CopyLoanSnapshot | null {
  if (v === null) return true
  return object(v) && v.schemaVersion === 1 && text(v.copyId) && text(v.resourceId) &&
    object(v.policy) && v.policy.resourceId === v.resourceId && text(v.policy.categoryId) &&
    (v.policy.durationHours === null || positive(v.policy.durationHours)) && positive(v.policy.effectiveDurationHours) &&
    ['RESOURCE', 'CATEGORY'].includes(String(v.policy.source)) && Array.isArray(v.accessories) &&
    v.accessories.every(p => object(p) && text(p.id) && text(p.nombre)) &&
    new Set(v.accessories.map(p => p.id)).size === v.accessories.length
}
export function validChecklist(v: unknown): v is ReturnChecklistCapture {
  if (!object(v) || !text(v.id) || !text(v.loanId) || !text(v.actorId) || !text(v.checkedAt) ||
    !Number.isFinite(Date.parse(v.checkedAt)) || !validSnapshot(v.configurationSnapshot) || !Array.isArray(v.parts)) return false
  const expected = v.configurationSnapshot?.accessories ?? []
  return v.parts.length === expected.length && new Set(v.parts.map(p => object(p) ? p.accessoryId : null)).size === v.parts.length &&
    v.parts.every(p => object(p) && text(p.accessoryId) && text(p.nombre) && typeof p.received === 'boolean' &&
      expected.some(a => a.id === p.accessoryId && a.nombre === p.nombre))
}
export function sameSnapshot(a: CopyLoanSnapshot | null, b: CopyLoanSnapshot | null): boolean {
  if (!a || !b) return a === b
  return a.copyId === b.copyId && a.resourceId === b.resourceId && a.schemaVersion === b.schemaVersion &&
    a.policy.resourceId === b.policy.resourceId && a.policy.categoryId === b.policy.categoryId &&
    a.policy.durationHours === b.policy.durationHours && a.policy.effectiveDurationHours === b.policy.effectiveDurationHours &&
    a.policy.source === b.policy.source && a.accessories.length === b.accessories.length &&
    a.accessories.every(p => b.accessories.some(other => other.id === p.id && other.nombre === p.nombre))
}
export function validLoanConfiguration(v: Record<string, unknown>): boolean {
  return (v.configurationSnapshot === undefined || (validSnapshot(v.configurationSnapshot) &&
    (v.configurationSnapshot === null || v.configurationSnapshot.copyId === v.copyId))) &&
    (v.returnChecklist === undefined || v.returnChecklist === null ||
      (validChecklist(v.returnChecklist) && v.returnChecklist.loanId === v.id &&
        validSnapshot(v.configurationSnapshot) && sameSnapshot(v.configurationSnapshot, v.returnChecklist.configurationSnapshot)))
}
export function validLoan(v: unknown): boolean {
  return object(v) && text(v.id) && text(v.copyId) && text(v.userId) && text(v.endsAt) &&
    ['ACTIVO', 'FINALIZADO', 'PLANIFICADO'].includes(String(v.status)) &&
    validLoanConfiguration(v)
}
export function pagination(query: Record<string, string>) {
  const page = Number(query.page ?? 1), limit = Number(query.limit ?? 20)
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new ApiError('Paginación inválida.', 400)
  return { page, limit }
}
export function parsePage<T>(value: unknown, valid: (item: unknown) => boolean, page: number, limit: number): Page<T> {
  if (!object(value) || !Array.isArray(value.items) || !value.items.every(valid) ||
    !Number.isInteger(value.total) || Number(value.total) < 0 || value.page !== page || value.limit !== limit ||
    value.items.length > limit || value.items.length > Number(value.total))
    throw new ApiError('El servidor no confirmó una página válida.', 0)
  return value as unknown as Page<T>
}
