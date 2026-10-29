import { Injectable } from '@nestjs/common';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ReviewRegistrationRequestInput } from '../ports/users.inputs.js';
import type { RegistrationRequest } from '../../domain/entities/registration-request.js';
import { RegistrationRequestRepository } from '../../domain/repositories/registration-request.repository.js';
import type { AuditActor } from '../../../../shared/application/audit-actor.js';

@Injectable()
export class RejectRegistrationRequestUseCase {
  constructor(private readonly requests: RegistrationRequestRepository) {}

  async execute(
    input: ReviewRegistrationRequestInput,
    actor?: AuditActor,
  ): Promise<RegistrationRequest> {
    const request = await this.requests.findById(input.requestId);
    if (!request)
      throw new NotFoundException('Solicitud de registro no encontrada.');
    if (request.status !== 'PENDIENTE') {
      throw new ConflictException(
        'Solo se pueden rechazar solicitudes pendientes.',
      );
    }
    const reason = input.rejectionReason?.trim() || undefined;
    return actor
      ? this.requests.updateStatus(
          input.requestId,
          'RECHAZADA',
          reason,
          undefined,
          actor,
        )
      : this.requests.updateStatus(input.requestId, 'RECHAZADA', reason);
  }
}
