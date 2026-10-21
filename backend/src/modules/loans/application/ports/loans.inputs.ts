export interface ReturnLoanInput {
  loanId: string;
  returnedAt: Date;
  observation?: string;
}

export interface GetLoanInput {
  loanId: string;
}

export interface ListUserLoanHistoryInput {
  userId: string;
}

export interface ListOverdueLoansInput {
  at: Date;
}
