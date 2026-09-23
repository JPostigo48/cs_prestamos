import { Injectable } from '@nestjs/common';
import type { CreateTermsVersionInput } from '../ports/terms.inputs.js';
import type { TermsVersion } from '../../domain/entities/terms.js';
import { TermsRepository } from '../../domain/repositories/terms.repository.js';

@Injectable()
export class CreateTermsVersionUseCase {
  constructor(private readonly terms: TermsRepository) {}

  async execute(_input: CreateTermsVersionInput): Promise<TermsVersion> {
    // TODO
    throw new Error('Not implemented');
  }
}
