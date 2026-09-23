import type { AccessAccount, AccessRole } from '../entities/access-account.js';

export interface CreateAccessAccountData {
  userId: string;
  email: string;
  passwordHash: string;
  role: AccessRole;
}

export abstract class AccessAccountRepository {
  abstract create(data: CreateAccessAccountData): Promise<AccessAccount>;
  abstract findById(accountId: string): Promise<AccessAccount | null>;
  abstract findByEmail(email: string): Promise<AccessAccount | null>;
  abstract findByUserId(userId: string): Promise<AccessAccount | null>;
  abstract recordAccess(accountId: string, accessedAt: Date): Promise<void>;
}
