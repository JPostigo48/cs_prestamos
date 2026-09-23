import { Injectable } from '@nestjs/common';
import type { ListOverdueLoansInput } from '../ports/loans.inputs.js';
import type { Loan } from '../../domain/entities/loan.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class ListOverdueLoansUseCase {
  constructor(private readonly loans: LoanRepository) {}

  async execute(_input: ListOverdueLoansInput): Promise<Loan[]> {
    // TODO
    throw new Error('Not implemented');
  }
}
