export interface AuthUser {
  userId: string;
  userType: 'ESTUDIANTE' | 'DOCENTE' | 'ADMINISTRATIVO';
  currentAffiliation: boolean;
}

export abstract class AuthUserPort {
  abstract getById(userId: string): Promise<AuthUser>;
}
