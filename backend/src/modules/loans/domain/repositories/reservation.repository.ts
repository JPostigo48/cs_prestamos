import type { Loan } from '../entities/loan.js';
import type { Reservation } from '../entities/reservation.js';
import type { Page, ReservationsQuery } from './loan-queries.js';

export interface CreateReservationData {
  userId: string;
  copyId: string;
  enforceSingleOpenOperation: boolean;
  requestedAt: Date;
  pickupDeadline: Date;
  loanDurationHours: number;
}

export interface CancelReservationData {
  reservationId: string;
  cancelledAt: Date;
  reason?: string;
}

export abstract class ReservationRepository {
  abstract findMany(query: ReservationsQuery): Promise<Page<Reservation>>;
  abstract hasOpenReservationOrLoan(userId: string): Promise<boolean>;
  abstract create(data: CreateReservationData): Promise<Reservation>;
  abstract findById(reservationId: string): Promise<Reservation | null>;
  abstract pickup(
    reservationId: string,
    pickedUpAt: Date,
  ): Promise<{ reservation: Reservation; loan: Loan }>;
  abstract cancel(data: CancelReservationData): Promise<Reservation>;
  abstract expire(at: Date): Promise<Reservation[]>;
}
