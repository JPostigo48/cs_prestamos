import type { AuditActor } from '../../../../shared/application/audit-actor.js';
import type { Sanction } from '../../../users/domain/entities/user.js';
import type { Appeal, AppealStatus } from '../entities/appeal.js';
import type { RuleVersion } from '../entities/usage-rule.js';
import type { Violation } from '../entities/violation.js';

export interface AppealsQuery {
  userId?: string;
  sanctionId?: string;
  status?: AppealStatus;
  page: number;
  limit: number;
}
export interface SanctionDetail extends Sanction {
  reason: string | null;
  rule: RuleVersion | null;
  violation: Violation | null;
  appeals: Appeal[];
  history: {
    action: string;
    occurredAt: Date;
    actorAccountId: string | null;
    reason: string | null;
  }[];
}
export interface SuspendUserData {
  userId: string;
  ruleId: string;
  reason: string;
  requestId: string;
  startsAt?: Date;
  endsAt?: Date | null;
  actor: AuditActor;
}
export abstract class SanctionRepository {
  abstract listAppeals(
    query: AppealsQuery,
  ): Promise<{ items: Appeal[]; total: number; page: number; limit: number }>;
  abstract findDetail(id: string): Promise<SanctionDetail | null>;
  abstract suspend(data: SuspendUserData): Promise<SanctionDetail>;
  abstract lift(
    id: string,
    resolution: string,
    actor: AuditActor,
  ): Promise<SanctionDetail>;
}
