import { Injectable } from '@nestjs/common';
import type { AcceptTermsVersionInput } from '../ports/terms.inputs.js';
import type { TermsAcceptance } from '../../domain/entities/terms.js';
import { TermsRepository } from '../../domain/repositories/terms.repository.js';

@Injectable()
export class AcceptTermsVersionUseCase {
  constructor(private readonly terms: TermsRepository) {}

  async execute(_input: AcceptTermsVersionInput): Promise<TermsAcceptance> {
    // TODO
    throw new Error('Not implemented');
  }
}
