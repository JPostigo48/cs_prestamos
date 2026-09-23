import type { UserType } from './registration-request.js';

export const TrustLevel = {
  NIVEL_1: 'NIVEL_1',
  NIVEL_2: 'NIVEL_2',
  NIVEL_3: 'NIVEL_3',
  NIVEL_4: 'NIVEL_4',
} as const;

export type TrustLevel = (typeof TrustLevel)[keyof typeof TrustLevel];

export const SanctionStatus = {
  ACTIVA: 'ACTIVA',
  FINALIZADA: 'FINALIZADA',
} as const;

export type SanctionStatus =
  (typeof SanctionStatus)[keyof typeof SanctionStatus];

export type Sanction = {
  id: string;
  userId: string;
  violationId: string | null;
  ruleId: string | null;
  ruleVersionId: string | null;
  status: SanctionStatus;
  startsAt: Date;
  endsAt: Date | null;
  previousTrust: number;
  resultingTrust: number;
};

export type User = {
  id: string;
  name: string;
  userType: UserType;
  institutionalId: string | null;
  hasCurrentAffiliation: boolean;
  trustPercentage: number;
};

export type UserTrustProfile = {
  userId: string;
  percentage: number;
  level: TrustLevel;
  currentlyPenalized: boolean;
};

export type LoanEligibility = {
  userId: string;
  enabled: boolean;
  trustPercentage: number;
  trustLevel: TrustLevel;
};
