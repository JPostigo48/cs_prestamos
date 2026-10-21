import type { Violation } from '../entities/violation.js';

export interface RegisterViolationData {
  userId: string;
  ruleId: string;
  ruleVersionId: string;
  occurredAt: Date;
  configuredPenalty: number;
}

export abstract class ViolationRepository {
  abstract createWithPenalty(data: RegisterViolationData): Promise<Violation>;
  abstract findById(violationId: string): Promise<Violation | null>;
}
