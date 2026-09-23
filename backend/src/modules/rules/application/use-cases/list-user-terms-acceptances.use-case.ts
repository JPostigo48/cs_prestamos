import { Injectable } from '@nestjs/common';
import type { ListUserTermsAcceptancesInput } from '../ports/terms.inputs.js';
import type { TermsAcceptance } from '../../domain/entities/terms.js';
import { TermsRepository } from '../../domain/repositories/terms.repository.js';

@Injectable()
export class ListUserTermsAcceptancesUseCase {
  constructor(private readonly terms: TermsRepository) {}

  async execute(
    _input: ListUserTermsAcceptancesInput,
  ): Promise<TermsAcceptance[]> {
    // TODO
    throw new Error('Not implemented');
  }
}
