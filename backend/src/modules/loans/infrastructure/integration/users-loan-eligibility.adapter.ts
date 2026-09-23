import { Injectable } from '@nestjs/common';
import {
  UserLoanEligibilityPort,
  type UserLoanEligibility,
} from '../../application/ports/user-loan-eligibility.port.js';
import { GetUserLoanEligibilityUseCase } from '../../../users/application/use-cases/get-user-loan-eligibility.use-case.js';

@Injectable()
export class UsersLoanEligibilityAdapter implements UserLoanEligibilityPort {
  constructor(private readonly getEligibility: GetUserLoanEligibilityUseCase) {}

  getByUserId(userId: string): Promise<UserLoanEligibility> {
    return this.getEligibility.execute({ userId });
  }
}
