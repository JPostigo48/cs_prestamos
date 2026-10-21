import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { SubmitAppealInput } from '../ports/violations.inputs.js';
import type { Appeal } from '../../domain/entities/appeal.js';
import { AppealRepository } from '../../domain/repositories/appeal.repository.js';
import { ViolationRepository } from '../../domain/repositories/violation.repository.js';

@Injectable()
export class SubmitAppealUseCase {
  constructor(
    private readonly appeals: AppealRepository,
    private readonly violations: ViolationRepository,
  ) {}

  async execute(input: SubmitAppealInput): Promise<Appeal> {
    const violation = await this.violations.findById(input.violationId);
    if (!violation || violation.userId !== input.userId) {
      throw new NotFoundException('Incumplimiento no encontrado.');
    }
    const sanction = await this.appeals.findSanctionByViolationId(input.violationId);
    if (!sanction || sanction.userId !== input.userId) {
      throw new NotFoundException('Sanción no encontrada.');
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
    if (await this.appeals.findByViolationId(input.violationId)) {
      throw new ConflictException('El incumplimiento ya tiene una apelación.');
    }
    return this.appeals.create({ ...input, submittedAt });
  }
}
