import type { AuditActor } from '../../../../shared/application/audit-actor.js';
import type { ReturnCommand } from '../../domain/entities/loan-closure.js';

export type ReturnLoanInput = ReturnCommand & {
  loanId: string;
  actor: AuditActor;
};

export interface GetLoanInput {
  loanId: string;
}

export interface ListUserLoanHistoryInput {
  userId: string;
}

export interface ListOverdueLoansInput {
  at: Date;
}
