import { Injectable } from '@nestjs/common';
import type { CreateLoanInput } from '../ports/loans.inputs.js';
import { LoanInventoryPort } from '../ports/loan-inventory.port.js';
import { UserLoanEligibilityPort } from '../ports/user-loan-eligibility.port.js';
import type { Loan } from '../../domain/entities/loan.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class CreateLoanUseCase {
  constructor(
    private readonly loans: LoanRepository,
    private readonly users: UserLoanEligibilityPort,
    private readonly inventory: LoanInventoryPort,
  ) {}

  async execute(_input: CreateLoanInput): Promise<Loan> {
    // TODO
    throw new Error('Not implemented');
  }
}
