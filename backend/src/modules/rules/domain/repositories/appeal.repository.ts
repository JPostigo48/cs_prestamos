import type { Appeal, AppealStatus } from '../entities/appeal.js';

export interface SubmitAppealData {
  violationId: string;
  userId: string;
  reason: string;
  submittedAt: Date;
}

export interface ResolveAppealData {
  appealId: string;
  status: Exclude<AppealStatus, AppealStatus.PENDING>;
  resolution: string;
  resolvedAt: Date;
  resolvedByAccountId: string;
}

export abstract class AppealRepository {
  abstract create(data: SubmitAppealData): Promise<Appeal>;
  abstract findById(appealId: string): Promise<Appeal | null>;
  abstract findByViolationId(violationId: string): Promise<Appeal | null>;
  abstract resolve(data: ResolveAppealData): Promise<Appeal>;
}
