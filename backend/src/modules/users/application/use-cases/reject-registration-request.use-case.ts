import { Injectable } from '@nestjs/common';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ReviewRegistrationRequestInput } from '../ports/users.inputs.js';
import type { RegistrationRequest } from '../../domain/entities/registration-request.js';
import { RegistrationRequestRepository } from '../../domain/repositories/registration-request.repository.js';

@Injectable()
export class RejectRegistrationRequestUseCase {
  constructor(private readonly requests: RegistrationRequestRepository) {}

  async execute(
    input: ReviewRegistrationRequestInput,
  ): Promise<RegistrationRequest> {
    const request = await this.requests.findById(input.requestId);
    if (!request) throw new NotFoundException('Solicitud de registro no encontrada.');
    if (request.status !== 'PENDIENTE') {
      throw new ConflictException('Solo se pueden rechazar solicitudes pendientes.');
    }
    const reason = input.rejectionReason?.trim() || undefined;
    return this.requests.updateStatus(input.requestId, 'RECHAZADA', reason);
  }
}
