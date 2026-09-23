import { Injectable } from '@nestjs/common';
import type { Loan } from '../../domain/entities/loan.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class ListActiveLoansUseCase {
  constructor(private readonly loans: LoanRepository) {}

  async execute(): Promise<Loan[]> {
    // TODO
    throw new Error('Not implemented');
  }
}
