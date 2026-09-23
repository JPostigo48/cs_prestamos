import { Injectable } from '@nestjs/common';
import type { ReturnLoanInput } from '../ports/loans.inputs.js';
import { LoanInventoryPort } from '../ports/loan-inventory.port.js';
import type { Loan } from '../../domain/entities/loan.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class ReturnLoanUseCase {
  constructor(
    private readonly loans: LoanRepository,
    private readonly inventory: LoanInventoryPort,
  ) {}

  async execute(_input: ReturnLoanInput): Promise<Loan> {
    // TODO
    throw new Error('Not implemented');
  }
}
