import type { UserType } from '../../domain/entities/registration-request.js';

export type SubmitRegistrationRequestInput = {
  userType: UserType;
  institutionalId?: string;
  evidence?: string[];
};

export type ReviewRegistrationRequestInput = {
  requestId: string;
};

export type GetRegistrationRequestInput = {
  requestId: string;
};

export type GetUserInput = {
  userId: string;
};

export type ApplyTrustPenaltyInput = {
  userId: string;
  violationId: string;
  ruleId: string;
  ruleVersionId: string;
  penaltyPercentage: number;
};
