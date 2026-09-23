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

  async execute(_input: SubmitAppealInput): Promise<Appeal> {
    // TODO
    throw new Error('Not implemented');
  }
}
