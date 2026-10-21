import { ConflictException, Injectable } from '@nestjs/common';
import type { Loan } from '../../domain/entities/loan.js';
import { ReservationRepository } from '../../domain/repositories/reservation.repository.js';
import type { PickupReservationInput } from '../ports/reservations.inputs.js';

@Injectable()
export class PickupReservationUseCase {
  constructor(private readonly reservations: ReservationRepository) {}

  async execute(input: PickupReservationInput): Promise<Loan> {
    const reservation = await this.reservations.findById(input.reservationId);
    if (!reservation) throw new ConflictException('La reserva no existe.');
    if (reservation.status !== 'CONFIRMADA') {
      throw new ConflictException('La reserva ya no está disponible para recogida.');
    }
    if (
      input.pickedUpAt.getTime() < reservation.requestedAt.getTime() ||
      input.pickedUpAt.getTime() > reservation.pickupDeadline.getTime()
    ) {
      throw new ConflictException('La recogida está fuera de la ventana permitida.');
    }
    const result = await this.reservations.pickup(input.reservationId, input.pickedUpAt);
    return result.loan;
  }
}
