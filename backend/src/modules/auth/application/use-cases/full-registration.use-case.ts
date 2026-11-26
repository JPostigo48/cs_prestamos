import { BadRequestException, Injectable } from '@nestjs/common';
import { CredentialsPort } from '../ports/credentials.port.js';
import {
  RegistrationPort,
  type FullRegistrationInput,
} from '../ports/registration.port.js';
import { InstitutionalEmailPolicy } from '../../domain/policies/institutional-email.policy.js';
import { isEmail, isUUID } from 'class-validator';
import { registrationFields } from '../../../users/domain/policies/registration-fields.policy.js';
import { createHash, randomUUID } from 'node:crypto';
import {
  decodeRegistrationEvidence,
  isRegistrationEvidence,
  type RegistrationEvidenceMetadata,
} from '../../../../shared/domain/registration-evidence.js';
import {
  REGISTRATION_EVIDENCE_BUCKET,
  SupabaseStorageService,
} from '../../../../shared/infrastructure/storage/supabase-storage.service.js';
export { isRegistrationImage } from '../../../../shared/domain/registration-image.js';

/** Evidencia de imagen pequeña, no URLs arbitrarias ni texto disfrazado de imagen. */
@Injectable()
export class FullRegistrationUseCase {
  constructor(
    private readonly registrations: RegistrationPort,
    private readonly credentials: CredentialsPort,
    private readonly storage?: SupabaseStorageService,
  ) {}

  async execute(input: FullRegistrationInput) {
    const fields = registrationFields(input);
    const email = typeof input.email === 'string' ? InstitutionalEmailPolicy.normalize(input.email) : '';
    if (email.length > 254 || !isEmail(email) || !InstitutionalEmailPolicy.isValid(email))
      throw new BadRequestException(['email debe ser un correo institucional del dominio exacto @unsa.edu.pe.']);
    if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128 || !/\S/u.test(input.password))
      throw new BadRequestException(['password debe tener entre 8 y 128 caracteres y no contener solo espacios.']);
    if (typeof input.termsVersionId !== 'string' || !isUUID(input.termsVersionId))
      throw new BadRequestException(['termsVersionId es obligatorio: acepte los términos vigentes.']);
    if (
      !Array.isArray(input.evidence) || input.evidence.length !== 1 ||
      !(await isRegistrationEvidence(input.evidence[0]))
    )
      throw new BadRequestException(
        'Adjunte una imagen PNG/JPEG de hasta 60 KiB o un PDF de hasta 10 MiB.',
      );
    const decoded = decodeRegistrationEvidence(input.evidence[0]);
    if (!decoded) {
      throw new BadRequestException('La evidencia de vinculación no es válida.');
    }

    let evidence = input.evidence;
    let uploadedPath: string | null = null;
    if (decoded.kind === 'pdf') {
      if (!this.storage) {
        throw new BadRequestException(
          'La carga de constancias PDF no está disponible.',
        );
      }
      const hash = createHash('sha256').update(decoded.bytes).digest('hex');
      uploadedPath = `registration-evidence/${randomUUID()}.pdf`;
      await this.storage.upload(
        uploadedPath,
        {
          buffer: decoded.bytes,
          mimetype: 'application/pdf',
          originalname: decoded.originalName,
        },
        REGISTRATION_EVIDENCE_BUCKET,
      );
      const metadata: RegistrationEvidenceMetadata = {
        kind: 'pdf',
        bucket: REGISTRATION_EVIDENCE_BUCKET,
        path: uploadedPath,
        originalName: decoded.originalName,
        mimeType: 'application/pdf',
        sizeBytes: decoded.bytes.length,
        hash,
      };
      evidence = [JSON.stringify(metadata)];
    }

    const { password, ...safe } = input;
    let result: { id: string; status: string };
    try {
      result = await this.registrations.submit({
        ...safe,
        ...fields,
        evidence,
        email,
        passwordHash: await this.credentials.hash(password),
        acceptedAt: new Date(),
      });
    } catch (error) {
      if (uploadedPath && this.storage) {
        await this.storage.remove(uploadedPath, REGISTRATION_EVIDENCE_BUCKET);
      }
      throw error;
    }
    return { id: result.id, status: result.status };
  }
}
