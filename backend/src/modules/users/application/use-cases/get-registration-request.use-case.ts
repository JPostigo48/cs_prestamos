import { Injectable } from '@nestjs/common';
import type { GetRegistrationRequestInput } from '../ports/users.inputs.js';
import type { RegistrationRequest } from '../../domain/entities/registration-request.js';
import { RegistrationRequestRepository } from '../../domain/repositories/registration-request.repository.js';

@Injectable()
export class GetRegistrationRequestUseCase {
  constructor(private readonly requests: RegistrationRequestRepository) {}

  async execute(
    _input: GetRegistrationRequestInput,
  ): Promise<RegistrationRequest> {
    // TODO
    throw new Error('Not implemented');
  }
}
