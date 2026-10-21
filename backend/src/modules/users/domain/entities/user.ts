import type { UserType } from './registration-request.js';

export const TrustLevel = {
  CRITICO: 'CRITICO',
  EN_OBSERVACION: 'EN_OBSERVACION',
  CONFIABLE: 'CONFIABLE',
  EXCELENTE: 'EXCELENTE',
} as const;

export function deriveTrustLevel(percentage: number): TrustLevel {
  if (percentage < 0 || percentage > 100 || !Number.isFinite(percentage)) {
    throw new RangeError('La confianza debe estar entre 0 y 100.');
  }
  if (percentage >= 75) return TrustLevel.EXCELENTE;
  if (percentage >= 50) return TrustLevel.CONFIABLE;
  if (percentage >= 25) return TrustLevel.EN_OBSERVACION;
  return TrustLevel.CRITICO;
}

export type TrustLevel = (typeof TrustLevel)[keyof typeof TrustLevel];

export const SanctionStatus = {
  PROGRAMADA: 'PROGRAMADA',
  ACTIVA: 'ACTIVA',
  FINALIZADA: 'FINALIZADA',
  ABSUELTA: 'ABSUELTA',
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
  institutionalType: UserType;
  eligible?: boolean;
  reasons?: string[];
  hasCurrentAffiliation?: boolean;
  activeSanctions?: Sanction[];
  trustPercentage: number;
  trustLevel: TrustLevel;
};
