import { Injectable } from '@nestjs/common';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { SubmitRegistrationRequestInput } from '../ports/users.inputs.js';
import type { RegistrationRequest } from '../../domain/entities/registration-request.js';
import { RegistrationRequestRepository } from '../../domain/repositories/registration-request.repository.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class SubmitRegistrationRequestUseCase {
  constructor(
    private readonly requests: RegistrationRequestRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(
    input: SubmitRegistrationRequestInput,
  ): Promise<RegistrationRequest> {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('name es obligatorio.');
    if (!input.userType) throw new BadRequestException('userType es obligatorio.');
    const institutionalId = input.institutionalId?.trim() || null;
    if (institutionalId) {
      const linkedUser = await this.users.findByInstitutionalId(institutionalId);
      if (linkedUser?.hasCurrentAffiliation) {
        throw new ConflictException('El identificador institucional ya está vinculado.');
      }
      const pending = await this.requests.findPendingByInstitutionalId(institutionalId);
      if (pending) throw new ConflictException('Ya existe una solicitud pendiente.');
    }
    return this.requests.create({
      name,
      userType: input.userType,
      institutionalId,
      evidence: (input.evidence ?? []).map((item) => item.trim()).filter(Boolean),
    });
  }
}
