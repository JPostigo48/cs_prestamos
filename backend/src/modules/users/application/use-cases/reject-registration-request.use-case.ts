import { Injectable } from '@nestjs/common';
import type { ReviewRegistrationRequestInput } from '../ports/users.inputs.js';
import type { RegistrationRequest } from '../../domain/entities/registration-request.js';
import { RegistrationRequestRepository } from '../../domain/repositories/registration-request.repository.js';

@Injectable()
export class RejectRegistrationRequestUseCase {
  constructor(private readonly requests: RegistrationRequestRepository) {}

  async execute(
    _input: ReviewRegistrationRequestInput,
  ): Promise<RegistrationRequest> {
    // TODO
    throw new Error('Not implemented');
  }
}
