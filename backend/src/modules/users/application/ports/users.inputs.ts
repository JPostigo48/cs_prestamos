import type { UserType } from '../../domain/entities/registration-request.js';

export type SubmitRegistrationRequestInput = {
  name: string;
  userType: UserType;
  institutionalId?: string;
  evidence?: string[];
};

export type ListRegistrationRequestsInput = {
  status?: string;
  institutionalId?: string;
  page?: number;
  limit?: number;
};

export type ReviewRegistrationRequestInput = {
  requestId: string;
  rejectionReason?: string;
};

export type GetRegistrationRequestInput = {
  requestId: string;
};

export type GetUserInput = {
  userId: string;
};

export type UpdateAffiliationStatusInput = {
  userId: string;
  hasCurrentAffiliation: boolean;
};

export type ListUsersInput = {
  userType?: string;
  hasCurrentAffiliation?: boolean;
  institutionalId?: string;
  page?: number;
  limit?: number;
};

export type ApplyTrustPenaltyInput = {
  userId: string;
  violationId: string;
  ruleId: string;
  ruleVersionId: string;
  penaltyPercentage: number;
};
