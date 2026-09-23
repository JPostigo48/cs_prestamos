import { Injectable } from '@nestjs/common';
import type { ResolveAppealInput } from '../ports/violations.inputs.js';
import type { Appeal } from '../../domain/entities/appeal.js';
import { AppealRepository } from '../../domain/repositories/appeal.repository.js';

@Injectable()
export class ResolveAppealUseCase {
  constructor(private readonly appeals: AppealRepository) {}

  async execute(_input: ResolveAppealInput): Promise<Appeal> {
    // TODO
    throw new Error('Not implemented');
  }
}
