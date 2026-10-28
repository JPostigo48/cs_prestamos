import type {
  LoanEligibility,
  Sanction,
  User,
  UserTrustProfile,
} from '../entities/user.js';
import type { AuditActor } from '../../../../shared/application/audit-actor.js';

export type ManagedUserData = Pick<
  User,
  'name' | 'userType' | 'institutionalId' | 'hasCurrentAffiliation'
>;

export abstract class UserRepository {
  abstract createManaged(
    data: ManagedUserData,
    actor: AuditActor,
  ): Promise<User>;
  abstract updateManaged(
    userId: string,
    data: Partial<ManagedUserData>,
    actor: AuditActor,
    action?: string,
  ): Promise<User>;
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
  abstract listSanctions(userId: string): Promise<Sanction[]>;
}
