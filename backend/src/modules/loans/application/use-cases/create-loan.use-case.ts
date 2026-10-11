import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { CreateLoanInput } from '../ports/loans.inputs.js';
import { LoanInventoryPort } from '../ports/loan-inventory.port.js';
import { UserLoanEligibilityPort } from '../ports/user-loan-eligibility.port.js';
import type { Loan } from '../../domain/entities/loan.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class CreateLoanUseCase {
  constructor(
    private readonly loans: LoanRepository,
    private readonly users: UserLoanEligibilityPort,
    private readonly inventory: LoanInventoryPort,
  ) {}

  async execute(input: CreateLoanInput): Promise<Loan> {
    const eligibility = await this.users.getByUserId(input.userId);
    if (!eligibility.enabled) {
      throw new ConflictException('El usuario no es elegible para préstamos.');
    }
    const availability = await this.inventory.getAvailability(input.copyId);
    if (!availability.available) {
      throw new ConflictException('El ejemplar no está disponible.');
    }
    if (input.startsAt.getTime() < Date.now()) {
      throw new BadRequestException('La fecha de inicio no puede estar en el pasado.');
    }
    const endsAt = new Date(input.startsAt);
    endsAt.setDate(endsAt.getDate() + availability.maximumLoanDays);
    if (await this.loans.hasOverlappingLoan(input.copyId, input.startsAt, endsAt)) {
      throw new ConflictException('El ejemplar ya tiene un préstamo solapado.');
    }
    return this.loans.createWithCopy({
      userId: input.userId,
      copyId: input.copyId,
      startsAt: input.startsAt,
      endsAt,
    });
  }
}
