import { Injectable } from '@nestjs/common';
import {
  UserLoanEligibilityPort,
  type UserLoanEligibility,
} from '../../application/ports/user-loan-eligibility.port.js';
import { GetUserLoanEligibilityUseCase } from '../../../users/application/use-cases/get-user-loan-eligibility.use-case.js';
import { LoanOverdueSynchronizer } from '../loan-overdue-synchronizer.js';

@Injectable()
export class UsersLoanEligibilityAdapter implements UserLoanEligibilityPort {
  constructor(
    private readonly getEligibility: GetUserLoanEligibilityUseCase,
    private readonly overdue: LoanOverdueSynchronizer,
  ) {}

  async getByUserId(userId: string): Promise<UserLoanEligibility> {
    await this.overdue.synchronizeUser(userId);
    return this.getEligibility.execute({ userId });
  }
}
