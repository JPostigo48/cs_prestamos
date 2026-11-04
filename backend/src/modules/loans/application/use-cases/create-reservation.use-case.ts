import { ConflictException, Injectable } from '@nestjs/common';
import type { Reservation } from '../../domain/entities/reservation.js';
import { ReservationRepository } from '../../domain/repositories/reservation.repository.js';
import { LoanInventoryPort } from '../ports/loan-inventory.port.js';
import { UserLoanEligibilityPort } from '../ports/user-loan-eligibility.port.js';
import type { CreateReservationInput } from '../ports/reservations.inputs.js';
import { TermsRepository } from '../../../rules/domain/repositories/terms.repository.js';
import { assertFuturePickup } from '../../../system/domain/reservation-settings.js';

@Injectable()
export class CreateReservationUseCase {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly users: UserLoanEligibilityPort,
    private readonly inventory: LoanInventoryPort,
    private readonly terms: TermsRepository,
  ) {}

  async execute(input: CreateReservationInput): Promise<Reservation> {
    const eligibility = await this.users.getByUserId(input.userId);
    if (!eligibility.enabled) {
      throw new ConflictException('El usuario no es elegible para préstamos.');
    }
    if (!await this.terms.hasAcceptedCurrentVersion(input.userId)) {
      throw new ConflictException('Debe aceptar la versión vigente de los términos antes de reservar.');
    }
    if (
      eligibility.institutionalType === 'ESTUDIANTE'
      && await this.reservations.hasOpenReservationOrLoan(input.userId)
    ) {
      throw new ConflictException('El estudiante ya tiene una operación abierta.');
    }
    assertFuturePickup(input.requestedAt);
    const availability = await this.inventory.getAvailability(input.copyId);
    if (!availability.available) {
      throw new ConflictException('El ejemplar no está disponible.');
    }
    // El repositorio calcula el plazo con la configuración bloqueada en la tx.
    return this.reservations.create({
      userId: input.userId,
      copyId: input.copyId,
      enforceSingleOpenOperation: eligibility.institutionalType === 'ESTUDIANTE',
      requestedAt: input.requestedAt,
      loanDurationHours: availability.maximumLoanHours,
    });
  }
}
