import { Injectable } from '@nestjs/common';
import type { ReturnLoanInput } from '../ports/loans.inputs.js';
import type { CloseLoanData } from '../../domain/entities/loan-closure.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class ReturnLoanUseCase {
  constructor(private readonly loans: LoanRepository) {}

  execute(input: ReturnLoanInput) {
    return this.loans.closeLoan(input);
  }

  closeIncident(input: CloseLoanData) {
    return this.loans.closeLoan(input);
  }

  readPolicy(loanId: string) {
    return this.loans.readReturnPolicy(loanId);
  }
}
