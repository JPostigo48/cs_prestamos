import { session } from './modules.mjs'
export const partId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const requestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const policyOption = (kind, severity = null) => ({
  id: kind + severity, ruleId: 'rule', versionId: 'version-' + kind + severity, number: 1, title: kind, key: kind + severity,
  kind, severity, category: 'Libros', categoryId: 'category', trustEffect: kind === 'REWARD' ? 'NONE' : 'DISCOUNT',
  penaltyPoints: kind === 'REWARD' ? null : 10, suspensionType: 'NINGUNA', suspensionDays: null,
  consequence: 'Consecuencia histórica ' + (severity ?? kind), criteria: { condition: 'Criterio histórico ' + (severity ?? kind) },
})
export const returnPolicy = (loanId = 'loan', accessories = [{ id: partId, nombre: 'Cable histórico' }]) => ({
  loanId, serverNow: '2026-01-02T00:00:00Z', endsAt: '2026-01-02T00:00:00Z', categoryId: 'category', termsVersionId: 'terms', policySource: 'LOAN_SNAPSHOT', accessories,
  damageOptions: ['LEVE', 'MODERADA', 'GRAVE'].map(s => policyOption('DAMAGE', s)),
  lateness: { automatic: true, currentSeverity: 'LEVE', targetSeverity: 'MODERADA', appliedPenaltyPoints: 5, targetPenaltyPoints: 10, targetSuspensionDays: 3 },
  lossPolicy: policyOption('LOSS'), rewardPolicy: policyOption('REWARD'),
})
export const activeLoan = (id = 'loan') => ({ id, userId: session().user.id, copyId: 'copy', status: 'ACTIVO', startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-02T00:00:00Z', return: null, configurationSnapshot: null, returnChecklist: null })
export const returnBody = (id = requestId) => ({ requestId: id, inspection: { parts: [{ accessoryId: partId, received: true }], condition: 'SANO', evidenceIds: [] } })
export function closedLoan(loan, body) {
  const incident = 'kind' in body
  return { ...loan, closureHistory: 'AVAILABLE', status: incident ? 'CERRADO_POR_INCIDENCIA' : 'FINALIZADO',
    return: incident ? null : { returnedAt: '2026-01-02T00:00:00Z', observation: body.observation ?? null },
    closure: { id: 'closure', requestId: body.requestId, reason: incident ? body.kind : 'DEVOLUCION', effectiveAt: '2026-01-02T00:00:00Z', actorAccountId: 'account', actorUserId: session().user.id, categoryId: 'category', termsVersionId: 'terms', inspection: incident ? null : { id: 'inspection', ...body.inspection } },
    consequences: [], reward: incident ? null : { eligible: true, reason: 'PUNTUAL_Y_COMPLETO', ruleVersionId: 'reward', referencePoints: 10, fraction: .1, calculatedPoints: 1, effectivePoints: .5, previousTrust: 99.5, resultingTrust: 100 },
    copy: { id: loan.copyId, estado: incident ? 'NO_DISPONIBLE' : 'DISPONIBLE', condicionFisica: incident ? 'PERDIDO' : 'APTO', habilitado: true }, cancelledReservationIds: [],
  }
}
