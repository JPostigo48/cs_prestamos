import { Injectable } from '@nestjs/common';
import type { GetUserInput } from '../ports/users.inputs.js';
import type { Sanction } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class ListUserSanctionsUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(_input: GetUserInput): Promise<Sanction[]> {
    // TODO
    throw new Error('Not implemented');
  }
}
