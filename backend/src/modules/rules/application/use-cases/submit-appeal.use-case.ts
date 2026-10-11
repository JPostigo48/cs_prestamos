import { Injectable } from '@nestjs/common';
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
      throw new Error('Incumplimiento no encontrado.');
    }
    if (await this.appeals.findByViolationId(input.violationId)) {
      throw new Error('El incumplimiento ya tiene una apelación.');
    }
    return this.appeals.create(input);
  }
}
