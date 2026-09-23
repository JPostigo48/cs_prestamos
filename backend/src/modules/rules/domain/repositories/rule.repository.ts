import type {
  RuleStatus,
  RuleVersion,
  UsageRule,
} from '../entities/usage-rule.js';

export interface RuleVersionData {
  title: string;
  description: string;
  penaltyPercentage: number;
  consequence: string;
}

export abstract class RuleRepository {
  abstract create(data: RuleVersionData): Promise<UsageRule>;
  abstract findById(ruleId: string): Promise<UsageRule | null>;
  abstract addVersion(
    ruleId: string,
    data: RuleVersionData,
  ): Promise<RuleVersion>;
  abstract setStatus(ruleId: string, status: RuleStatus): Promise<RuleVersion>;
  abstract findActiveVersions(): Promise<RuleVersion[]>;
}
