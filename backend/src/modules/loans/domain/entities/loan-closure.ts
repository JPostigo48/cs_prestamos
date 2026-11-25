import type { AuditActor } from '../../../../shared/application/audit-actor.js';
import type { PublicPolicy } from '../../../rules/domain/entities/public-terms.js';
import type { Loan } from './loan.js';

export type DamageSeverity = 'LEVE' | 'MODERADA' | 'GRAVE';
export interface FinalInspection {
  parts: { accessoryId: string; received: boolean }[];
  condition: 'SANO' | 'DESGASTE_NORMAL' | 'DANADO';
  damageSeverity?: DamageSeverity;
  description?: string;
  evidenceIds: string[];
}
export interface ReturnCommand {
  requestId: string;
  inspection: FinalInspection;
  observation?: string;
}
export interface IncidentCommand {
  requestId: string;
  kind: 'PERDIDA' | 'ROBO';
  confirmed: true;
  description: string;
  evidenceIds: string[];
}
export type CloseLoanData = { loanId: string; actor: AuditActor } & (
  ReturnCommand | IncidentCommand
);
export interface ClosureReward {
  eligible: boolean;
  reason: 'PUNTUAL_Y_COMPLETO' | 'MORA' | 'INCIDENTE';
  ruleVersionId: string;
  referencePoints: number;
  fraction: number;
  calculatedPoints: number;
  effectivePoints: number;
  previousTrust: number;
  resultingTrust: number;
}
export interface ClosureConsequence {
  violationId: string;
  sanctionId: string;
  kind: string;
  severity: string | null;
  ruleVersionId: string;
  configuredPenaltyPoints: number | null;
  effectivePenaltyTotal: number;
  suspensionType: string;
  suspensionDays: number | null;
  startsAt: string;
  endsAt: string | null;
}
export interface ClosureProjection {
  closure: {
    id: string;
    requestId: string;
    reason: 'DEVOLUCION' | 'PERDIDA' | 'ROBO';
    effectiveAt: string;
    actorAccountId: string;
    actorUserId: string;
    categoryId: string;
    termsVersionId: string;
    inspection: (FinalInspection & { id: string }) | null;
  } | null;
  consequences: ClosureConsequence[];
  reward: ClosureReward | null;
  copy: {
    id: string;
    estado: string;
    condicionFisica: string | null;
    habilitado: boolean;
  } | null;
  cancelledReservationIds: string[];
}
export interface ReturnPolicy {
  loanId: string;
  serverNow: string;
  endsAt: string;
  categoryId: string;
  termsVersionId: string;
  policySource: string;
  accessories: { id: string; nombre: string }[];
  damageOptions: (PublicPolicy & { versionId: string })[];
  lateness: {
    automatic: true;
    currentSeverity: string | null;
    targetSeverity: string | null;
    appliedPenaltyPoints: number;
    targetPenaltyPoints: number;
    targetSuspensionDays: number;
  };
  lossPolicy: PublicPolicy & { versionId: string };
  rewardPolicy: PublicPolicy & { versionId: string };
}

/** Resultado JSON original del cierre; restaura solo las fechas del contrato existente. */
export function restoreClosedLoan(value: unknown): Loan {
  const loan = value as Loan;
  return {
    ...loan,
    startsAt: new Date(loan.startsAt),
    endsAt: new Date(loan.endsAt),
    return: loan.return
      ? { ...loan.return, returnedAt: new Date(loan.return.returnedAt) }
      : null,
    returnChecklist: loan.returnChecklist
      ? {
          ...loan.returnChecklist,
          checkedAt: new Date(loan.returnChecklist.checkedAt),
        }
      : null,
  };
}
