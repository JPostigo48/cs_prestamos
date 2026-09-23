import { Injectable } from '@nestjs/common';
import type { GetUserInput } from '../ports/users.inputs.js';
import type { LoanEligibility } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class GetUserLoanEligibilityUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(_input: GetUserInput): Promise<LoanEligibility> {
    // TODO
    throw new Error('Not implemented');
  }
}
