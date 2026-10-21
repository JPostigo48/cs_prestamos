import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateAffiliationStatusInput } from '../ports/users.inputs.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class UpdateAffiliationStatusUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: UpdateAffiliationStatusInput) {
    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return this.users.updateAffiliationStatus(input.userId, input.hasCurrentAffiliation);
  }
}