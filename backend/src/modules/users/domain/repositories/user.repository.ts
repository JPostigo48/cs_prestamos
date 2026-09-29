import type {
  LoanEligibility,
  Sanction,
  User,
  UserTrustProfile,
} from '../entities/user.js';

export type ApplyTrustPenaltyData = {
  userId: string;
  violationId: string;
  ruleId: string;
  ruleVersionId: string;
  penaltyPercentage: number;
};

export abstract class UserRepository {
  abstract save(user: User): Promise<User>;
  abstract findById(userId: string): Promise<User | null>;
  abstract findByInstitutionalId(institutionalId: string): Promise<User | null>;
  abstract updateAffiliationStatus(
    userId: string,
    hasCurrentAffiliation: boolean,
  ): Promise<User>;
  abstract list(filters: {
    userType?: string;
    hasCurrentAffiliation?: boolean;
    institutionalId?: string;
    page: number;
    limit: number;
  }): Promise<{ items: User[]; total: number; page: number; limit: number }>;
  abstract getLoanEligibility(userId: string): Promise<LoanEligibility>;
  abstract getTrustProfile(userId: string): Promise<UserTrustProfile>;
  abstract applyTrustPenalty(
    data: ApplyTrustPenaltyData,
  ): Promise<UserTrustProfile>;
  abstract listSanctions(userId: string): Promise<Sanction[]>;
}
