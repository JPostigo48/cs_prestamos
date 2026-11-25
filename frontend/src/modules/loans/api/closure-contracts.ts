import type { FinalInspection, ReturnPolicy, PolicyOption } from '../return-policy'
export interface LoanClosure {
  id: string; requestId: string; reason: 'DEVOLUCION' | 'PERDIDA' | 'ROBO'; effectiveAt: string
  actorAccountId: string; actorUserId: string; categoryId: string; termsVersionId: string
  inspection: (FinalInspection & { id: string }) | null
}
export interface LoanConsequence {
  violationId: string; sanctionId: string; kind: string; severity: string | null; ruleVersionId: string
  configuredPenaltyPoints: number | null; effectivePenaltyTotal: number; suspensionType: string
  suspensionDays: number | null; startsAt: string; endsAt: string | null
}
export interface LoanReward {
  eligible: boolean; reason: string; ruleVersionId: string; referencePoints: number; fraction: number
  calculatedPoints: number; effectivePoints: number; previousTrust: number; resultingTrust: number
}
export interface ClosedCopy { id: string; estado: 'DISPONIBLE' | 'NO_DISPONIBLE'; condicionFisica: string | null; habilitado: boolean }
export interface LoanEvidence { id: string; loanId: string; type: 'ENTREGA' | 'DEVOLUCION' | 'DANO' | 'PERDIDA'; originalName: string; description: string | null }
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim()
const instant = (v: unknown) => text(v) && Number.isFinite(Date.parse(v))
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const nullableNum = (v: unknown) => v === null || num(v)
function option(v: unknown): v is PolicyOption {
  return obj(v) && ['id', 'ruleId', 'versionId', 'title', 'key', 'kind', 'consequence'].every(k => text(v[k])) &&
    Number.isInteger(v.number) && ['DISCOUNT', 'SET_ZERO', 'NONE'].includes(String(v.trustEffect)) && nullableNum(v.penaltyPoints) && nullableNum(v.suspensionDays) &&
    obj(v.criteria) && text(v.criteria.condition)
}
export function validReturnPolicy(v: unknown, loanId: string): v is ReturnPolicy {
  const damageOptions = obj(v) && Array.isArray(v.damageOptions) ? v.damageOptions : []
  return obj(v) && v.loanId === loanId && instant(v.serverNow) && instant(v.endsAt) && text(v.categoryId) && text(v.termsVersionId) &&
    ['LOAN_SNAPSHOT', 'LOAN_NO_SHOW_SNAPSHOT', 'RESERVATION_SNAPSHOT', 'RESERVATION_CONFIRMATION'].includes(String(v.policySource)) &&
    Array.isArray(v.accessories) && v.accessories.every(p => obj(p) && text(p.id) && text(p.nombre)) && new Set(v.accessories.map(p => p.id)).size === v.accessories.length &&
    Array.isArray(v.damageOptions) && damageOptions.length === 3 && ['LEVE', 'MODERADA', 'GRAVE'].every(s => damageOptions.filter((p: unknown) => option(p) && p.kind === 'DAMAGE' && p.severity === s).length === 1) &&
    option(v.lossPolicy) && v.lossPolicy.kind === 'LOSS' && option(v.rewardPolicy) && v.rewardPolicy.kind === 'REWARD' &&
    obj(v.lateness) && v.lateness.automatic === true && num(v.lateness.appliedPenaltyPoints) && num(v.lateness.targetPenaltyPoints) && num(v.lateness.targetSuspensionDays)
}
export function validClosureFields(v: Record<string, unknown>): boolean {
  const reward = v.reward
  if (v.closure === undefined || v.closure === null) return true // Lecturas legadas, nunca confirman una operación nueva.
  const c = v.closure
  if (!obj(c) || !['id', 'requestId', 'actorAccountId', 'actorUserId', 'categoryId', 'termsVersionId'].every(k => text(c[k])) || !instant(c.effectiveAt) || !['DEVOLUCION', 'PERDIDA', 'ROBO'].includes(String(c.reason))) return false
  if (c.reason === 'DEVOLUCION') {
    const i = c.inspection
    if (v.status !== 'FINALIZADO' || !obj(v.return) || !instant(v.return.returnedAt) || !obj(i) || !text(i.id) || !['SANO', 'DESGASTE_NORMAL', 'DANADO'].includes(String(i.condition)) || !Array.isArray(i.parts) || !i.parts.every(p => obj(p) && text(p.accessoryId) && typeof p.received === 'boolean') || !Array.isArray(i.evidenceIds)) return false
  } else if (v.status !== 'CERRADO_POR_INCIDENCIA' || c.inspection !== null || v.return !== null || v.reward !== null) return false
  return Array.isArray(v.consequences) && v.consequences.every(p => obj(p) && text(p.violationId) && text(p.sanctionId) && text(p.kind) && text(p.ruleVersionId) && num(p.effectivePenaltyTotal) && nullableNum(p.configuredPenaltyPoints) && nullableNum(p.suspensionDays) && instant(p.startsAt) && (p.endsAt === null || instant(p.endsAt))) &&
    (reward === null || (obj(reward) && typeof reward.eligible === 'boolean' && text(reward.reason) && text(reward.ruleVersionId) && ['referencePoints', 'fraction', 'calculatedPoints', 'effectivePoints', 'previousTrust', 'resultingTrust'].every(k => num(reward[k])))) &&
    obj(v.copy) && v.copy.id === v.copyId && ['DISPONIBLE', 'NO_DISPONIBLE'].includes(String(v.copy.estado)) && (v.copy.condicionFisica === null || text(v.copy.condicionFisica)) && typeof v.copy.habilitado === 'boolean' &&
    Array.isArray(v.cancelledReservationIds) && v.cancelledReservationIds.every(text)
}
