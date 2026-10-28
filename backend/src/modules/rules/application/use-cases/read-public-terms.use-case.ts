import { Injectable, NotFoundException } from '@nestjs/common';
import { TermsRepository } from '../../domain/repositories/terms.repository.js';

@Injectable()
export class ReadPublicTermsUseCase {
  constructor(private readonly terms: TermsRepository) {}

  async execute(versionId?: string) {
    const version = await this.terms.readPublicVersion(versionId);
    if (!version)
      throw new NotFoundException(
        'No hay una versión de términos publicada para esta consulta.',
      );
    return version;
  }
}
