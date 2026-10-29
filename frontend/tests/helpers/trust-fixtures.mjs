export const ruleId = '22222222-2222-4222-8222-222222222222'
export const versionId = '33333333-3333-4333-8333-333333333333'
export const userId = '11111111-1111-4111-8111-111111111111'
export const rule = (changes = {}) => ({
  id: versionId, ruleId, number: 2, title: 'Daño acreditado', description: 'Regla manual configurada',
  penaltyPercentage: 10, consequence: 'Consecuencia versionada real', suspensionType: 'TEMPORAL', suspensionDays: 7, status: 'ACTIVA', ...changes,
})
export const sanction = (changes = {}) => ({
  id: 'sanction-real', userId, ruleId, ruleVersionId: versionId, violationId: null,
  status: 'ACTIVA', startsAt: '2026-10-28T00:00:00Z', endsAt: '2026-11-04T00:00:00Z',
  previousTrust: 80, resultingTrust: 70, reason: 'Motivo registrado', rule: rule(), violation: null,
  appeals: [], history: [], ...changes,
})
export const appeal = (changes = {}) => ({
  id: 'appeal-real', violationId: 'violation-real', sanctionId: 'sanction-real', userId,
  reason: 'Revisión solicitada', submittedAt: '2026-10-28T00:00:00Z', status: 'PENDIENTE',
  resolution: null, resolvedAt: null, resolvedByAccountId: null, ...changes,
})
