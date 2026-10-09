import { Injectable } from '@nestjs/common';
import type { ListRegistrationRequestsInput } from '../ports/users.inputs.js';
import { RegistrationRequestRepository } from '../../domain/repositories/registration-request.repository.js';

@Injectable()
export class ListRegistrationRequestsUseCase {
  constructor(private readonly requests: RegistrationRequestRepository) {}

  execute(input: ListRegistrationRequestsInput) {
    return this.requests.list({
      status: input.status as any,
      institutionalId: input.institutionalId?.trim(),
      page: Math.max(1, Number(input.page) || 1),
      limit: Math.min(100, Math.max(1, Number(input.limit) || 20)),
    });
  }
}
