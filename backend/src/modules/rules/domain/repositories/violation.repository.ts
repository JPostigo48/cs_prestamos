import type { Violation } from '../entities/violation.js';

export interface RegisterViolationData {
  userId: string;
  ruleId: string;
  ruleVersionId: string;
  occurredAt: Date;
  appliedPenalty: number;
}

export abstract class ViolationRepository {
  abstract create(data: RegisterViolationData): Promise<Violation>;
  abstract findById(violationId: string): Promise<Violation | null>;
}
