import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { SubmitAppealInput } from '../ports/violations.inputs.js';
import type { Appeal } from '../../domain/entities/appeal.js';
import { AppealRepository } from '../../domain/repositories/appeal.repository.js';

@Injectable()
export class SubmitAppealUseCase {
  constructor(private readonly appeals: AppealRepository) {}

  async execute(input: SubmitAppealInput): Promise<Appeal> {
    const sanction = await this.appeals.findSanctionById(input.sanctionId);
    if (!sanction || sanction.userId !== input.userId) {
      throw new NotFoundException('Sanción no encontrada.');
    }
    if (!sanction.violationId) {
      throw new ConflictException('La sanción no tiene un incumplimiento asociado.');
    }
    const submittedAt = new Date();
    const finishedAt = sanction.status === 'FINALIZADA'
      ? (sanction.endsAt ?? sanction.startsAt)
      : (sanction.endsAt && sanction.endsAt <= submittedAt ? sanction.endsAt : null);
    const appealDeadline = finishedAt
      ? new Date(finishedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
      : null;
    if (sanction.status === 'ABSUELTA' ||
      (appealDeadline !== null && submittedAt > appealDeadline)) {
      throw new ConflictException('El plazo para apelar esta sanción ha terminado.');
    }
    if (await this.appeals.findByViolationId(sanction.violationId)) {
      throw new ConflictException('El incumplimiento ya tiene una apelación.');
    }
    return this.appeals.create({ ...input, violationId: sanction.violationId, submittedAt });
  }
}
