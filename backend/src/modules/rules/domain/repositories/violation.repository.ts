import type { Violation } from '../entities/violation.js';
import type { SuspensionType } from '../entities/usage-rule.js';

export interface RegisterViolationData {
  userId: string;
  ruleId: string;
  ruleVersionId: string;
  occurredAt: Date;
  configuredPenalty: number;
  trustEffect?: 'DISCOUNT' | 'SET_ZERO';
  suspensionType: SuspensionType;
  suspensionDays: number | null;
}

export abstract class ViolationRepository {
  abstract createWithPenalty(data: RegisterViolationData): Promise<Violation>;
  abstract findById(violationId: string): Promise<Violation | null>;
}
