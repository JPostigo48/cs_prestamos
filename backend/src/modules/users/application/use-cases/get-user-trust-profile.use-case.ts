import { Injectable } from '@nestjs/common';
import type { GetUserInput } from '../ports/users.inputs.js';
import type { UserTrustProfile } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class GetUserTrustProfileUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(_input: GetUserInput): Promise<UserTrustProfile> {
    // TODO
    throw new Error('Not implemented');
  }
}
