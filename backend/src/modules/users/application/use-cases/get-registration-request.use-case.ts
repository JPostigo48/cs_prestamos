import { Injectable } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import type { GetRegistrationRequestInput } from '../ports/users.inputs.js';
import type { RegistrationRequest } from '../../domain/entities/registration-request.js';
import { RegistrationRequestRepository } from '../../domain/repositories/registration-request.repository.js';

@Injectable()
export class GetRegistrationRequestUseCase {
  constructor(private readonly requests: RegistrationRequestRepository) {}

  async execute(
    input: GetRegistrationRequestInput,
  ): Promise<RegistrationRequest> {
    const request = await this.requests.findById(input.requestId);
    if (!request) throw new NotFoundException('Solicitud de registro no encontrada.');
    return request;
  }
}
