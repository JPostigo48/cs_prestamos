export interface CreateReservationInput {
  userId: string;
  copyId: string;
  requestedAt: Date;
}

export interface PickupReservationInput {
  reservationId: string;
  pickedUpAt: Date;
}

export interface CancelReservationInput {
  reservationId: string;
  reason?: string;
}

export interface ExpireReservationsInput {
  at: Date;
}
