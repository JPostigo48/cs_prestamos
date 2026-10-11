import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ResolveAppealInput } from '../ports/violations.inputs.js';
import type { Appeal } from '../../domain/entities/appeal.js';
import { AppealRepository } from '../../domain/repositories/appeal.repository.js';

@Injectable()
export class ResolveAppealUseCase {
  constructor(private readonly appeals: AppealRepository) {}

  async execute(input: ResolveAppealInput): Promise<Appeal> {
    const appeal = await this.appeals.findById(input.appealId);
    if (!appeal) throw new NotFoundException('Apelación no encontrada.');
    if (appeal.status !== 'PENDIENTE') throw new ConflictException('La apelación ya fue resuelta.');
    return this.appeals.resolve(input);
  }
}
