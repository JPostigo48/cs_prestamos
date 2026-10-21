import { Injectable } from '@nestjs/common';
import type { GetUserInput } from '../ports/users.inputs.js';
import type { LoanEligibility } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class GetUserLoanEligibilityUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: GetUserInput): Promise<LoanEligibility> {
    return this.users.getLoanEligibility(input.userId);
  }
}
