import { BadRequestException, Injectable } from '@nestjs/common';
import { CredentialsPort } from '../ports/credentials.port.js';
import {
  RegistrationPort,
  type FullRegistrationInput,
} from '../ports/registration.port.js';
import { InstitutionalEmailPolicy } from '../../domain/policies/institutional-email.policy.js';
import { isRegistrationImage } from '../../../../shared/domain/registration-image.js';
export { isRegistrationImage } from '../../../../shared/domain/registration-image.js';

/** Evidencia de imagen pequeña, no URLs arbitrarias ni texto disfrazado de imagen. */
@Injectable()
export class FullRegistrationUseCase {
  constructor(
    private readonly registrations: RegistrationPort,
    private readonly credentials: CredentialsPort,
  ) {}

  async execute(input: FullRegistrationInput) {
    const email = InstitutionalEmailPolicy.assertValid(input.email);
    if (
      input.evidence.length !== 1 ||
      !(await isRegistrationImage(input.evidence[0]))
    )
      throw new BadRequestException(
        'Adjunte una imagen PNG o JPEG de hasta 60 KiB.',
      );
    const { password, ...safe } = input;
    const result = await this.registrations.submit({
      ...safe,
      email,
      passwordHash: await this.credentials.hash(password),
      acceptedAt: new Date(),
    });
    return { id: result.id, status: result.status };
  }
}
