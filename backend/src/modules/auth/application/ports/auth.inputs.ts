import type { AccessRole } from '../../domain/entities/access-account.js';

export interface RegisterAccessAccountInput {
  userId: string;
  email: string;
  password: string;
  role?: AccessRole;
}

export interface AuthenticateAccountInput {
  email: string;
  password: string;
}

export interface GetAccessAccountInput {
  accountId: string;
}

export interface AuthenticatedIdentity {
  accountId: string;
  userId: string;
  userType: 'ESTUDIANTE' | 'DOCENTE' | 'ADMINISTRATIVO';
  role: AccessRole;
}
