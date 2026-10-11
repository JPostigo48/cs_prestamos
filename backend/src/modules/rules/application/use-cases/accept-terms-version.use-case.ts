import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AcceptTermsVersionInput } from '../ports/terms.inputs.js';
import type { TermsAcceptance } from '../../domain/entities/terms.js';
import { TermsRepository } from '../../domain/repositories/terms.repository.js';

@Injectable()
export class AcceptTermsVersionUseCase {
  constructor(private readonly terms: TermsRepository) {}

  async execute(input: AcceptTermsVersionInput): Promise<TermsAcceptance> {
    if (!(await this.terms.findVersionById(input.termsVersionId))) {
      throw new NotFoundException('Versión de términos no encontrada.');
    }
    try {
      return await this.terms.accept(input);
    } catch (error) {
      if (String(error).includes('ya fueron aceptados')) {
        throw new ConflictException('Los términos ya fueron aceptados.');
      }
      throw error;
    }
  }
}
