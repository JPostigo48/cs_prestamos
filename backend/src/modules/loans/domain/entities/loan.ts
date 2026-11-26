import type { CopyLoanSnapshot } from '../../../inventory/domain/entities/resource-configuration.js';
import type { ClosureProjection } from './loan-closure.js';

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
  CLOSED_INCIDENT = 'CERRADO_POR_INCIDENCIA',
}

export interface LoanReturn {
  id: string;
  loanId: string;
  returnedAt: Date;
  observation: string | null;
}

export interface Loan {
  /** Unavailable history is not evidence that this loan has no closure. */
  closureHistory?: 'AVAILABLE' | 'UNAVAILABLE';
  closure?: ClosureProjection['closure'];
  consequences?: ClosureProjection['consequences'];
  reward?: ClosureProjection['reward'];
  copy?: ClosureProjection['copy'];
  cancelledReservationIds?: ClosureProjection['cancelledReservationIds'];
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
