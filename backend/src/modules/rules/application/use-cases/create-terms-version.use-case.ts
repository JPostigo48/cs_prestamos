import { Injectable } from '@nestjs/common';
import type { CreateTermsVersionInput } from '../ports/terms.inputs.js';
import type { TermsVersion } from '../../domain/entities/terms.js';
import { TermsRepository } from '../../domain/repositories/terms.repository.js';

@Injectable()
export class CreateTermsVersionUseCase {
  constructor(private readonly terms: TermsRepository) {}

  async execute(input: CreateTermsVersionInput): Promise<TermsVersion> {
    return this.terms.createVersion(input);
  }
}
