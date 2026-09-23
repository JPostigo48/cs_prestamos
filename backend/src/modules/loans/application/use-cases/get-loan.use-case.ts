import { Injectable } from '@nestjs/common';
import type { GetLoanInput } from '../ports/loans.inputs.js';
import type { Loan } from '../../domain/entities/loan.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class GetLoanUseCase {
  constructor(private readonly loans: LoanRepository) {}

  async execute(_input: GetLoanInput): Promise<Loan> {
    // TODO
    throw new Error('Not implemented');
  }
}
