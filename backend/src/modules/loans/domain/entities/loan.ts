export enum LoanStatus {
  PLANNED = 'PLANIFICADO',
  ACTIVE = 'ACTIVO',
  COMPLETED = 'FINALIZADO',
}

export interface LoanReturn {
  id: string;
  loanId: string;
  returnedAt: Date;
  observation: string | null;
}

export interface Loan {
  id: string;
  userId: string;
  copyId: string;
  startsAt: Date;
  endsAt: Date;
  status: LoanStatus;
  return: LoanReturn | null;
}
