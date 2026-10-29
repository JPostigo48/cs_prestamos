import { Injectable } from '@nestjs/common';
import { SubmitRegistrationRequestUseCase } from '../../../users/application/use-cases/submit-registration-request.use-case.js';
import { RegistrationPort } from '../../application/ports/registration.port.js';

@Injectable()
export class UsersRegistrationAdapter implements RegistrationPort {
  constructor(
    private readonly submitRequest: SubmitRegistrationRequestUseCase,
  ) {}

  submit(input: Parameters<RegistrationPort['submit']>[0]) {
    return this.submitRequest.execute(input, {
      email: input.email,
      passwordHash: input.passwordHash,
      termsVersionId: input.termsVersionId,
      acceptedAt: input.acceptedAt,
    });
  }
}
