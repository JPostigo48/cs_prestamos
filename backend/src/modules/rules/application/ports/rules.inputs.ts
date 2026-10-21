import type { RuleStatus, SuspensionType } from '../../domain/entities/usage-rule.js';

export interface CreateRuleInput {
  title: string;
  description: string;
  penaltyPercentage: number;
  consequence: string;
  suspensionType: SuspensionType;
  suspensionDays?: number | null;
}

export interface UpdateRuleInput extends CreateRuleInput {
  ruleId: string;
}

export interface SetRuleStatusInput {
  ruleId: string;
  status: RuleStatus;
}
