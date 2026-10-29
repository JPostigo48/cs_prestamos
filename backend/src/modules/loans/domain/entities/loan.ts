import type { CopyLoanSnapshot } from '../../../inventory/domain/entities/resource-configuration.js';

export interface ReturnChecklistPart {
  accessoryId: string;
  nombre: string;
  received: boolean;
}

export interface ReturnChecklist {
  id: string;
  loanId: string;
  actorId: string;
  checkedAt: Date;
  configurationSnapshot: CopyLoanSnapshot | null;
  parts: ReturnChecklistPart[];
}

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
  configurationSnapshot?: CopyLoanSnapshot | null;
  returnChecklist?: ReturnChecklist | null;
}
