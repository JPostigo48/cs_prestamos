import { Injectable } from '@nestjs/common';
import type { ListOverdueLoansInput } from '../ports/loans.inputs.js';
import type { Loan } from '../../domain/entities/loan.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class ListOverdueLoansUseCase {
  constructor(private readonly loans: LoanRepository) {}

  async execute(input: ListOverdueLoansInput): Promise<Loan[]> {
    return this.loans.findOverdue(input.at);
  }
}
