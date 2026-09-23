import { Injectable } from '@nestjs/common';
import type { ListUserLoanHistoryInput } from '../ports/loans.inputs.js';
import type { Loan } from '../../domain/entities/loan.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class ListUserLoanHistoryUseCase {
  constructor(private readonly loans: LoanRepository) {}

  async execute(_input: ListUserLoanHistoryInput): Promise<Loan[]> {
    // TODO
    throw new Error('Not implemented');
  }
}
