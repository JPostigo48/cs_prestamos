import type { Loan, ReturnChecklist } from '../entities/loan.js';
import type { CloseLoanData, ReturnPolicy } from '../entities/loan-closure.js';
import type {
  Page,
  ResourceHistoryQuery,
  SaveReturnChecklistData,
} from './loan-queries.js';

export abstract class LoanRepository {
  abstract findResourceHistory(
    resourceId: string,
    query: ResourceHistoryQuery,
  ): Promise<Page<Loan>>;
  abstract saveReturnChecklist(
    data: SaveReturnChecklistData,
  ): Promise<ReturnChecklist>;
  abstract findById(loanId: string): Promise<Loan | null>;
  abstract findActive(): Promise<Loan[]>;
  abstract findByUserId(userId: string): Promise<Loan[]>;
  abstract findOverdue(at: Date): Promise<Loan[]>;
  abstract hasOverlappingLoan(
    copyId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean>;
  abstract closeLoan(data: CloseLoanData): Promise<Loan>;
  abstract readReturnPolicy(loanId: string): Promise<ReturnPolicy>;
}
