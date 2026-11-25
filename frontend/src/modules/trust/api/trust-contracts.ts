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
  current?: SanctionCurrent | null
  userId: string
  ruleVersionId: string | null
  reason: string | null
  rule: RuleVersion | null
  violation: Violation | null
  appeals: Appeal[]
  history: { action: string; occurredAt: string; actorAccountId: string | null; reason: string | null }[]
}
export interface SanctionAdjustment {
  id: string; ruleVersionId: string; severity: string; effect: 'DISCOUNT' | 'SET_ZERO'
  nominalTarget: number | null; nominalIncrement: number | null; effectiveDiscount: number
  previousTrust: number; resultingTrust: number; suspensionDays: number | null
  effectiveAt: string; recordedAt: string
}
export interface SanctionCurrent {
  severity: string; rule: RuleVersion; nominalPenaltyTotal: number | null
  effectivePenaltyTotal: number; suspensionDays: number | null; adjustments: SanctionAdjustment[]
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
  // Las políticas oficiales requieren contexto del préstamo, no una sanción genérica.
  return false
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
  if (value.current !== undefined && value.current !== null && !validCurrent(value.current)) return false
  const violation = value.violation
  return violation === null || (record(violation) && text(violation.id) && text(violation.userId) && text(violation.ruleId) && text(violation.ruleVersionId) && validInstant(violation.occurredAt) && typeof violation.appliedPenalty === 'number' && Number.isFinite(violation.appliedPenalty))
}
const points = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100
const days = (v: unknown) => v === null || (Number.isSafeInteger(v) && Number(v) > 0)
function validCurrent(value: unknown): value is SanctionCurrent {
  if (!record(value) || !text(value.severity) || !validRule(value.rule) ||
    !(value.nominalPenaltyTotal === null || points(value.nominalPenaltyTotal)) ||
    !points(value.effectivePenaltyTotal) || !days(value.suspensionDays) ||
    !Array.isArray(value.adjustments) || !value.adjustments.length) return false
  for (const a of value.adjustments) {
    if (!record(a) || !text(a.id) || !text(a.ruleVersionId) || !text(a.severity) ||
      !['DISCOUNT', 'SET_ZERO'].includes(String(a.effect)) || !points(a.effectiveDiscount) ||
      !points(a.previousTrust) || !points(a.resultingTrust) || !days(a.suspensionDays) ||
      !validInstant(a.effectiveAt) || !validInstant(a.recordedAt) ||
      Math.round((a.previousTrust - a.resultingTrust) * 100) !== Math.round(a.effectiveDiscount * 100)) return false
    if (a.effect === 'SET_ZERO' ? a.nominalTarget !== null || a.nominalIncrement !== null || a.suspensionDays !== null || a.resultingTrust !== 0 :
      !points(a.nominalTarget) || !points(a.nominalIncrement) || a.nominalIncrement > a.nominalTarget || a.suspensionDays === null) return false
  }
  const adjustments = value.adjustments as unknown as SanctionAdjustment[]
  const last = adjustments[adjustments.length - 1]!
  return new Set(adjustments.map(a => a.id)).size === adjustments.length &&
    last.ruleVersionId === value.rule.id && last.severity === value.severity &&
    last.nominalTarget === value.nominalPenaltyTotal && last.suspensionDays === value.suspensionDays &&
    adjustments.reduce((sum, a) => sum + Math.round(a.effectiveDiscount * 100), 0) === Math.round(value.effectivePenaltyTotal * 100)
}
