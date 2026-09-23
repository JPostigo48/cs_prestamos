import type { RuleStatus } from '../../domain/entities/usage-rule.js';

export interface CreateRuleInput {
  title: string;
  description: string;
  penaltyPercentage: number;
  consequence: string;
}

export interface UpdateRuleInput extends CreateRuleInput {
  ruleId: string;
}

export interface SetRuleStatusInput {
  ruleId: string;
  status: RuleStatus;
}
