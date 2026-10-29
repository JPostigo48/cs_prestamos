import type { CopyLoanSnapshot } from '../../../inventory/domain/entities/resource-configuration.js';

export enum ReservationStatus {
  CONFIRMED = 'CONFIRMADA',
  PICKED_UP = 'RECOGIDA',
  CANCELLED = 'CANCELADA',
  EXPIRED = 'VENCIDA',
}

export interface Reservation {
  id: string;
  userId: string;
  copyId: string;
  requestedAt: Date;
  pickupDeadline: Date;
  loanDurationHours: number;
  pickedUpAt: Date | null;
  cancelledAt: Date | null;
  status: ReservationStatus;
  cancellationReason: string | null;
  loanId: string | null;
  configurationSnapshot?: CopyLoanSnapshot | null;
}
