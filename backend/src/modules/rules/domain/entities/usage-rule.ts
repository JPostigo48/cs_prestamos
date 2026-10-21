export enum RuleStatus {
  ACTIVE = 'ACTIVA',
  INACTIVE = 'INACTIVA',
}

export enum SuspensionType {
  NONE = 'NINGUNA',
  TEMPORARY = 'TEMPORAL',
  INDEFINITE = 'INDEFINIDA',
}

export interface RuleVersion {
  id: string;
  ruleId: string;
  number: number;
  title: string;
  description: string;
  penaltyPercentage: number;
  consequence: string;
  suspensionType: SuspensionType | null;
  suspensionDays: number | null;
  status: RuleStatus;
}

export interface UsageRule {
  id: string;
  currentVersionId: string | null;
  versions: RuleVersion[];
}
