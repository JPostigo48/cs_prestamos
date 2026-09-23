export interface Violation {
  id: string;
  userId: string;
  ruleId: string;
  ruleVersionId: string;
  occurredAt: Date;
  appliedPenalty: number;
}
