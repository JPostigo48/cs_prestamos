import { Injectable } from '@nestjs/common';
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

  async execute(input: ReviewRegistrationRequestInput): Promise<{ request: RegistrationRequest; user: User }> {
    const request = await this.requests.findById(input.requestId);
    if (!request) throw new NotFoundException('Solicitud de registro no encontrada.');
    if (request.status !== 'PENDIENTE') {
      throw new ConflictException('La solicitud ya fue procesada.');
    }
    try {
      const result = await this.requests.approveAndCreateUser(input.requestId);
      return result;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ConflictException('No se pudo aprobar la solicitud en su estado actual.');
    }
  }
}
