export interface ApplyRulePenaltyInput {
  userId: string;
  violationId: string;
  ruleId: string;
  ruleVersionId: string;
  penaltyPercentage: number;
}

export abstract class UserTrustPort {
  abstract applyPenalty(input: ApplyRulePenaltyInput): Promise<void>;
}
