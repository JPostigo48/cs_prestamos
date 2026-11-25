import type { PublicPolicy } from '../project-showcase/services/termsApi'

export type Severity = 'LEVE' | 'MODERADA' | 'GRAVE'
export type PhysicalCondition = 'SANO' | 'DESGASTE_NORMAL' | 'DANADO'
export interface FinalInspection {
  parts: { accessoryId: string; received: boolean }[]
  condition: PhysicalCondition
  damageSeverity?: Severity
  description?: string
  evidenceIds: string[]
}
export interface ReturnInput { requestId: string; inspection: FinalInspection; observation?: string }
export interface IncidentInput { requestId: string; kind: 'PERDIDA' | 'ROBO'; confirmed: true; description: string; evidenceIds: string[] }
export type ClosureInput = ReturnInput | IncidentInput
export type PolicyOption = PublicPolicy & { versionId: string }
export interface ReturnPolicy {
  loanId: string; serverNow: string; endsAt: string; categoryId: string; termsVersionId: string
  policySource: string
  accessories: { id: string; nombre: string }[]
  damageOptions: PolicyOption[]
  lateness: { automatic: true; currentSeverity: string | null; targetSeverity: string | null; appliedPenaltyPoints: number; targetPenaltyPoints: number; targetSuspensionDays: number }
  lossPolicy: PolicyOption; rewardPolicy: PolicyOption
}
export function returnInput(requestId: string, policy: ReturnPolicy, parts: Record<string, boolean | null>, condition: PhysicalCondition | '', damage: Severity | '', missing: Severity | '', description: string, evidenceIds: string[], observation = ''): ReturnInput {
  if (!policy || !Array.isArray(policy.accessories)) throw new Error('No se confirmó el snapshot histórico.')
  if (Object.keys(parts).length !== policy.accessories.length || policy.accessories.some(p => typeof parts[p.id] !== 'boolean')) throw new Error('Revisa explícitamente todas las partes históricas.')
  if (!['SANO', 'DESGASTE_NORMAL', 'DANADO'].includes(condition)) throw new Error('Selecciona la condición física.')
  const missingParts = policy.accessories.some(p => parts[p.id] === false)
  const levels: Severity[] = ['LEVE', 'MODERADA', 'GRAVE']
  if ((condition === 'DANADO' && !levels.includes(damage as Severity)) || (missingParts && !levels.includes(missing as Severity))) throw new Error('Selecciona la gravedad de cada incidencia según los criterios.')
  const incident = condition === 'DANADO' || missingParts
  if (incident && !description.trim()) throw new Error('Describe el daño o los faltantes.')
  if (description.trim().length > 1000 || observation.length > 1000) throw new Error('El texto admite hasta 1000 caracteres.')
  const severity = levels[Math.max(condition === 'DANADO' ? levels.indexOf(damage as Severity) : -1, missingParts ? levels.indexOf(missing as Severity) : -1)]
  return { requestId, inspection: {
    parts: policy.accessories.map(p => ({ accessoryId: p.id, received: parts[p.id] === true })),
    condition: condition as PhysicalCondition,
    ...(incident ? { damageSeverity: severity, description: description.trim() } : {}), evidenceIds: [...evidenceIds],
  }, ...(observation.trim() ? { observation: observation.trim() } : {}) }
}
export function uncertainReturn(status: number | undefined): boolean { return status === undefined || status === 0 || status >= 500 }
