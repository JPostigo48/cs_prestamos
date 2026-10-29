import type { LoanStatus } from '../entities/loan.js';
import type { ReservationStatus } from '../entities/reservation.js';

export interface PageQuery {
  page: number;
  limit: number;
}
export interface Page<T> extends PageQuery {
  items: T[];
  total: number;
}
export interface ResourceHistoryQuery extends PageQuery {
  status?: LoanStatus;
}
export interface ReservationsQuery extends PageQuery {
  status?: ReservationStatus;
  userId?: string;
  copyId?: string;
}
export interface SaveReturnChecklistData {
  loanId: string;
  actorId: string;
  checkedAt: Date;
  parts: { accessoryId: string; received: boolean }[];
}
