import { Injectable } from '@nestjs/common';
import type { ReviewRegistrationRequestInput } from '../ports/users.inputs.js';
import type { User } from '../../domain/entities/user.js';
import { RegistrationRequestRepository } from '../../domain/repositories/registration-request.repository.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class ApproveRegistrationRequestUseCase {
  constructor(
    private readonly requests: RegistrationRequestRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(_input: ReviewRegistrationRequestInput): Promise<User> {
    // TODO
    throw new Error('Not implemented');
  }
}
