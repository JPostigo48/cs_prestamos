import type { Sanction } from '../../users/api/student-api'
import { validInstant, validPeriod } from '../../../shared/api/calendar'

export interface Appeal {
  id: string
  violationId: string
  sanctionId: string | null
  userId: string
  reason: string
  submittedAt: string
  status: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA'
  resolution: string | null
  resolvedAt: string | null
  resolvedByAccountId: string | null
}
export interface RuleVersion {
  id: string
  ruleId: string
  number: number
  title: string
  description: string
  penaltyPercentage: number
  consequence: string
  suspensionType: 'NINGUNA' | 'TEMPORAL' | 'INDEFINIDA' | null
  suspensionDays: number | null
  status: 'ACTIVA' | 'INACTIVA'
}
export interface Violation {
  id: string
  userId: string
  ruleId: string
  ruleVersionId: string
  occurredAt: string
  appliedPenalty: number
}
export interface SanctionDetail extends Sanction {
  userId: string
  ruleVersionId: string | null
  reason: string | null
  rule: RuleVersion | null
  violation: Violation | null
  appeals: Appeal[]
  history: { action: string; occurredAt: string; actorAccountId: string | null; reason: string | null }[]
}
export interface AppealPage { items: Appeal[]; total: number; page: number; limit: number }
export const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
const nullableText = (value: unknown) => value === null || typeof value === 'string'
export const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function validAppeal(value: unknown): value is Appeal {
  return record(value) && text(value.id) && text(value.violationId) && text(value.userId) &&
    nullableText(value.sanctionId) && text(value.reason) && validInstant(value.submittedAt) &&
    ['PENDIENTE', 'ACEPTADA', 'RECHAZADA'].includes(String(value.status)) && nullableText(value.resolution) &&
    (value.resolvedAt === null || validInstant(value.resolvedAt)) && nullableText(value.resolvedByAccountId)
}
export function validRule(value: unknown): value is RuleVersion {
  return record(value) && text(value.id) && text(value.ruleId) && Number.isInteger(value.number) &&
    typeof value.title === 'string' && typeof value.description === 'string' && typeof value.consequence === 'string' &&
    typeof value.penaltyPercentage === 'number' && Number.isFinite(value.penaltyPercentage) &&
    ['ACTIVA', 'INACTIVA'].includes(String(value.status)) &&
    (value.suspensionType === null || ['NINGUNA', 'TEMPORAL', 'INDEFINIDA'].includes(String(value.suspensionType))) &&
    (value.suspensionDays === null || Number.isInteger(value.suspensionDays))
}
export function manualSuspensionRule(rule: RuleVersion): boolean {
  if (rule.status !== 'ACTIVA' || !uuid(rule.ruleId)) return false
  if (!(rule.suspensionType === 'INDEFINIDA' && rule.suspensionDays === null) &&
    !(rule.suspensionType === 'TEMPORAL' && Number.isSafeInteger(rule.suspensionDays) && rule.suspensionDays! > 0)) return false
  let policy: unknown
  try { policy = JSON.parse(rule.description) } catch { return rule.penaltyPercentage > 0 && rule.penaltyPercentage <= 100 }
  if (!record(policy) || policy.format !== 'epcc.official-policy/v1') return rule.penaltyPercentage > 0 && rule.penaltyPercentage <= 100
  if (!['DAMAGE', 'LOSS'].includes(String(policy.kind))) return false
  return policy.trustEffect === 'SET_ZERO'
    ? rule.penaltyPercentage === 0 && rule.suspensionType === 'INDEFINIDA'
    : policy.trustEffect === 'DISCOUNT' && rule.penaltyPercentage > 0 && rule.penaltyPercentage <= 100
}
export function validSuspension(value: unknown): value is SanctionDetail {
  return validSanctionDetail(value) && ['ACTIVA', 'PROGRAMADA'].includes(value.status) &&
    validPeriod(value.startsAt, value.endsAt)
}
export function validSanctionDetail(value: unknown): value is SanctionDetail {
  if (!record(value) || !text(value.id) || !text(value.userId) ||
    !['ACTIVA', 'PROGRAMADA', 'FINALIZADA', 'ABSUELTA'].includes(String(value.status)) ||
    !validInstant(value.startsAt) || !(value.endsAt === null || validInstant(value.endsAt)) ||
    typeof value.previousTrust !== 'number' || !Number.isFinite(value.previousTrust) ||
    typeof value.resultingTrust !== 'number' || !Number.isFinite(value.resultingTrust) ||
    !nullableText(value.ruleId) || !nullableText(value.ruleVersionId) || !nullableText(value.violationId) || !nullableText(value.reason) ||
    !(value.rule === null || validRule(value.rule)) || !Array.isArray(value.appeals) || !value.appeals.every(validAppeal) ||
    !Array.isArray(value.history) || !value.history.every(h => record(h) && text(h.action) && validInstant(h.occurredAt) && nullableText(h.actorAccountId) && nullableText(h.reason))) return false
  if (value.rule && (value.rule.ruleId !== value.ruleId || value.rule.id !== value.ruleVersionId)) return false
  if (value.appeals.some(a => a.sanctionId !== value.id || a.userId !== value.userId)) return false
  const violation = value.violation
  return violation === null || (record(violation) && text(violation.id) && text(violation.userId) && text(violation.ruleId) && text(violation.ruleVersionId) && validInstant(violation.occurredAt) && typeof violation.appliedPenalty === 'number' && Number.isFinite(violation.appliedPenalty))
}
