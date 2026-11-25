import { BadRequestException, Injectable } from '@nestjs/common';
import { CredentialsPort } from '../ports/credentials.port.js';
import {
  RegistrationPort,
  type FullRegistrationInput,
} from '../ports/registration.port.js';
import { InstitutionalEmailPolicy } from '../../domain/policies/institutional-email.policy.js';
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
    const email = InstitutionalEmailPolicy.assertValid(input.email);
    if (
      input.evidence.length !== 1 ||
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
