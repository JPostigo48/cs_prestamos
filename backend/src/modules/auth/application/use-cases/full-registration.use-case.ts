import { BadRequestException, Injectable } from '@nestjs/common';
import { CredentialsPort } from '../ports/credentials.port.js';
import {
  RegistrationPort,
  type FullRegistrationInput,
} from '../ports/registration.port.js';
import { InstitutionalEmailPolicy } from '../../domain/policies/institutional-email.policy.js';

/** Evidencia de imagen pequeña, no URLs arbitrarias ni texto disfrazado de imagen. */
export function isRegistrationImage(value: string): boolean {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    value,
  );
  if (!match || value.length > 82000) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 60 * 1024) return false;
  if (bytes.toString('base64') !== match[2]) return false;
  return match[1] === 'png'
    ? bytes.length >= 24 &&
        bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
        bytes.toString('ascii', 12, 16) === 'IHDR'
    : bytes.length >= 4 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff &&
        bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]));
}

@Injectable()
export class FullRegistrationUseCase {
  constructor(
    private readonly registrations: RegistrationPort,
    private readonly credentials: CredentialsPort,
  ) {}

  async execute(input: FullRegistrationInput) {
    const email = InstitutionalEmailPolicy.assertValid(input.email);
    if (input.evidence.length !== 1 || !isRegistrationImage(input.evidence[0]))
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
