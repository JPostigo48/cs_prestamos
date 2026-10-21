import { ConflictException, Injectable } from '@nestjs/common';
import type { Reservation } from '../../domain/entities/reservation.js';
import { ReservationRepository } from '../../domain/repositories/reservation.repository.js';
import type { CancelReservationInput } from '../ports/reservations.inputs.js';

@Injectable()
export class CancelReservationUseCase {
  constructor(private readonly reservations: ReservationRepository) {}

  async execute(input: CancelReservationInput & { userId: string }): Promise<Reservation> {
    const reservation = await this.reservations.findById(input.reservationId);
    if (!reservation) throw new ConflictException('La reserva no existe.');
    if (reservation.userId !== input.userId) {
      throw new ConflictException('La reserva no pertenece al usuario autenticado.');
    }
    if (reservation.status !== 'CONFIRMADA') {
      throw new ConflictException('Solo se pueden cancelar reservas confirmadas.');
    }
    return this.reservations.cancel({
      reservationId: input.reservationId,
      reason: input.reason,
    });
  }
}
