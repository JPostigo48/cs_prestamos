import { Injectable } from '@nestjs/common';
import type { AcceptTermsVersionInput } from '../ports/terms.inputs.js';
import type { TermsAcceptance } from '../../domain/entities/terms.js';
import { TermsRepository } from '../../domain/repositories/terms.repository.js';

@Injectable()
export class AcceptTermsVersionUseCase {
  constructor(private readonly terms: TermsRepository) {}

  async execute(input: AcceptTermsVersionInput): Promise<TermsAcceptance> {
    if (!(await this.terms.findVersionById(input.termsVersionId))) {
      throw new Error('Versión de términos no encontrada.');
    }
    return this.terms.accept(input);
  }
}
