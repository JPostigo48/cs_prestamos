export interface UserLoanEligibility {
  userId: string;
  enabled: boolean;
  institutionalType?: 'ESTUDIANTE' | 'DOCENTE' | 'ADMINISTRATIVO';
}

export abstract class UserLoanEligibilityPort {
  abstract getByUserId(userId: string): Promise<UserLoanEligibility>;
}
