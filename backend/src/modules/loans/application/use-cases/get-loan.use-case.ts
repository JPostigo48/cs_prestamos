import { Injectable, NotFoundException } from '@nestjs/common';
import type { GetLoanInput } from '../ports/loans.inputs.js';
import type { Loan } from '../../domain/entities/loan.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class GetLoanUseCase {
  constructor(private readonly loans: LoanRepository) {}

  async execute(input: GetLoanInput): Promise<Loan> {
    const loan = await this.loans.findById(input.loanId);
    if (!loan) throw new NotFoundException('Préstamo no encontrado.');
    return loan;
  }
}
