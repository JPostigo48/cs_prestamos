export enum RuleStatus {
  ACTIVE = 'ACTIVA',
  INACTIVE = 'INACTIVA',
}

export interface RuleVersion {
  id: string;
  ruleId: string;
  number: number;
  title: string;
  description: string;
  penaltyPercentage: number;
  consequence: string;
  status: RuleStatus;
}

export interface UsageRule {
  id: string;
  currentVersionId: string | null;
  versions: RuleVersion[];
}
