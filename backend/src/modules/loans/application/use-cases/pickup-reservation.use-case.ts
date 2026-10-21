import { ConflictException, Injectable } from '@nestjs/common';
import type { Loan } from '../../domain/entities/loan.js';
import { ReservationRepository } from '../../domain/repositories/reservation.repository.js';
import type { PickupReservationInput } from '../ports/reservations.inputs.js';
import { UserLoanEligibilityPort } from '../ports/user-loan-eligibility.port.js';
import { TermsRepository } from '../../../rules/domain/repositories/terms.repository.js';

@Injectable()
export class PickupReservationUseCase {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly users: UserLoanEligibilityPort,
    private readonly terms: TermsRepository,
  ) {}

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
    const eligibility = await this.users.getByUserId(reservation.userId);
    if (!eligibility.enabled) {
      throw new ConflictException('El usuario no es elegible para préstamos.');
    }
    if (!await this.terms.hasAcceptedCurrentVersion(reservation.userId)) {
      throw new ConflictException('Debe aceptar la versión vigente de los términos antes de recoger.');
    }
    const result = await this.reservations.pickup(input.reservationId, input.pickedUpAt);
    return result.loan;
  }
}
