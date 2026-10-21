import type { Loan, LoanReturn } from '../entities/loan.js';

export interface RegisterLoanReturnData {
  loanId: string;
  returnedAt: Date;
  observation?: string;
}

export abstract class LoanRepository {
  abstract findById(loanId: string): Promise<Loan | null>;
  abstract findActive(): Promise<Loan[]>;
  abstract findByUserId(userId: string): Promise<Loan[]>;
  abstract findOverdue(at: Date): Promise<Loan[]>;
  abstract hasOverlappingLoan(
    copyId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean>;
  abstract registerReturn(data: RegisterLoanReturnData): Promise<LoanReturn>;
  abstract registerReturnWithCopy(data: RegisterLoanReturnData): Promise<LoanReturn>;
}
