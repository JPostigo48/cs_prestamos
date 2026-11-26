import { Injectable } from '@nestjs/common';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { SubmitRegistrationRequestInput } from '../ports/users.inputs.js';
import type { RegistrationRequest } from '../../domain/entities/registration-request.js';
import { RegistrationRequestRepository } from '../../domain/repositories/registration-request.repository.js';
import type { PendingAccessData } from '../../domain/repositories/registration-request.repository.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { registrationFields } from '../../domain/policies/registration-fields.policy.js';

@Injectable()
export class SubmitRegistrationRequestUseCase {
  constructor(
    private readonly requests: RegistrationRequestRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(
    input: SubmitRegistrationRequestInput,
    access?: PendingAccessData,
  ): Promise<RegistrationRequest> {
    const { name, institutionalId, phone } = registrationFields(input);
    if (!Array.isArray(input.evidence) || input.evidence.length !== 1 || typeof input.evidence[0] !== 'string' || !input.evidence[0].trim())
      throw new BadRequestException(['evidence requiere exactamente una evidencia.']);
    if (institutionalId) {
      const linkedUser =
        await this.users.findByInstitutionalId(institutionalId);
      if (linkedUser?.hasCurrentAffiliation) {
        throw new ConflictException(
          'El identificador institucional ya está vinculado.',
        );
      }
      const pending =
        await this.requests.findPendingByInstitutionalId(institutionalId);
      if (pending)
        throw new ConflictException('Ya existe una solicitud pendiente.');
    }
    return this.requests.create({
      name,
      userType: input.userType,
      institutionalId,
      phone,
      evidence: (input.evidence ?? [])
        .map((item) => item.trim())
        .filter(Boolean),
      ...(access ? { access } : {}),
    });
  }
}
