import { Injectable } from '@nestjs/common';
import type { GetUserInput } from '../ports/users.inputs.js';
import type { User } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class GetUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(_input: GetUserInput): Promise<User> {
    // TODO
    throw new Error('Not implemented');
  }
}
