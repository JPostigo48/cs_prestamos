import type { AppealStatus } from '../../domain/entities/appeal.js';

export interface RegisterViolationInput {
  userId: string;
  ruleId: string;
  occurredAt: Date;
}

export interface SubmitAppealInput {
  violationId: string;
  userId: string;
  reason: string;
  submittedAt: Date;
}

export interface ResolveAppealInput {
  appealId: string;
  status: Exclude<AppealStatus, AppealStatus.PENDING>;
  resolution: string;
  resolvedAt: Date;
  resolvedByAccountId: string;
}
