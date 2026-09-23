export interface UserLoanEligibility {
  userId: string;
  enabled: boolean;
}

export abstract class UserLoanEligibilityPort {
  abstract getByUserId(userId: string): Promise<UserLoanEligibility>;
}
