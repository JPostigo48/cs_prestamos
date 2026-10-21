export interface Violation {
  id: string;
  userId: string;
  ruleId: string;
  ruleVersionId: string;
  occurredAt: Date;
  appliedPenalty: number;
}

export function calculateTrustPenalty(currentTrust: number, configuredPenalty: number) {
  const current = Math.round(currentTrust * 100);
  const penalty = Math.round(configuredPenalty * 100);
  const resulting = Math.max(0, current - penalty);
  return {
    appliedPenalty: (current - resulting) / 100,
    resultingTrust: resulting / 100,
  };
}
