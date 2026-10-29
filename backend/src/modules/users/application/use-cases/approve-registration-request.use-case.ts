import { Injectable } from '@nestjs/common';
import type { AuditActor } from '../../../../shared/application/audit-actor.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ReviewRegistrationRequestInput } from '../ports/users.inputs.js';
import type { User } from '../../domain/entities/user.js';
import type { RegistrationRequest } from '../../domain/entities/registration-request.js';
import { RegistrationRequestRepository } from '../../domain/repositories/registration-request.repository.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class ApproveRegistrationRequestUseCase {
  constructor(
    private readonly requests: RegistrationRequestRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(
    input: ReviewRegistrationRequestInput,
    actor?: AuditActor,
  ): Promise<{ request: RegistrationRequest; user: User }> {
    const request = await this.requests.findById(input.requestId);
    if (!request)
      throw new NotFoundException('Solicitud de registro no encontrada.');
    if (request.status !== 'PENDIENTE') {
      throw new ConflictException('La solicitud ya fue procesada.');
    }
    try {
      const result = await this.requests.approveAndCreateUser(
        input.requestId,
        actor,
      );
      return result;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      const value = error as { code?: string; cause?: { code?: string } };
      if (value?.code === '23505' || value?.cause?.code === '23505')
        throw new ConflictException(
          'El usuario o su cuenta ya están registrados.',
        );
      throw error;
    }
  }
}
