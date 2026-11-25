import sharp from 'sharp';

export const MAX_REGISTRATION_IMAGE_BYTES = 60 * 1024;
export const MAX_REGISTRATION_PDF_BYTES = 10 * 1024 * 1024;

export type RegistrationEvidenceMetadata = {
  kind: 'pdf';
  bucket: string;
  path: string;
  originalName: string;
  mimeType: 'application/pdf';
  sizeBytes: number;
  hash: string;
};

function matchesRegistrationImage(
  bytes: Buffer,
  mimeType: 'image/png' | 'image/jpeg',
): boolean {
  if (mimeType === 'image/png') {
    return (
      bytes.length >= 20 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      bytes.subarray(-12).equals(Buffer.from('0000000049454e44ae426082', 'hex'))
    );
  }
  return (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  );
}

export function registrationEvidenceMetadata(
  value: unknown,
): RegistrationEvidenceMetadata | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as Partial<RegistrationEvidenceMetadata>;
    if (
      parsed.kind === 'pdf' &&
      typeof parsed.bucket === 'string' &&
      typeof parsed.path === 'string' &&
      typeof parsed.originalName === 'string' &&
      parsed.mimeType === 'application/pdf' &&
      Number.isInteger(parsed.sizeBytes) &&
      typeof parsed.hash === 'string'
    ) {
      return parsed as RegistrationEvidenceMetadata;
    }
  } catch {}
  return null;
}

export function decodeRegistrationEvidence(value: string): {
  kind: 'image' | 'pdf';
  bytes: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'application/pdf';
  originalName: string;
} | null {
  const match =
    /^data:(image\/(?:png|jpeg)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!match) return null;
  const mimeType = match[1] as 'image/png' | 'image/jpeg' | 'application/pdf';
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.toString('base64') !== match[2]) return null;

  if (mimeType === 'application/pdf') {
    if (
      bytes.length > MAX_REGISTRATION_PDF_BYTES ||
      bytes.subarray(0, 5).toString('ascii') !== '%PDF-' ||
      !/%%EOF(?:[\s\x00]*)$/.test(bytes.subarray(-1024).toString('latin1'))
    ) {
      return null;
    }
    return { kind: 'pdf', bytes, mimeType, originalName: 'constancia.pdf' };
  }

  if (
    bytes.length > MAX_REGISTRATION_IMAGE_BYTES ||
    !matchesRegistrationImage(bytes, mimeType)
  ) {
    return null;
  }
  return {
    kind: 'image',
    bytes,
    mimeType,
    originalName: mimeType === 'image/png' ? 'constancia.png' : 'constancia.jpg',
  };
}

export async function isRegistrationEvidence(value: unknown): Promise<boolean> {
  if (typeof value !== 'string') return false;
  if (registrationEvidenceMetadata(value)?.kind === 'pdf') return true;

  if (/^data:image\/(png|jpeg);base64,/u.test(value)) {
    const decoded = decodeRegistrationEvidence(value);
    if (!decoded || decoded.kind !== 'image') return false;
    try {
      const decoder = sharp(decoded.bytes, {
        failOn: 'warning',
        limitInputPixels: 4_000_000,
        sequentialRead: true,
      }).timeout({ seconds: 2 });
      const metadata = await decoder.metadata();
      if (
        metadata.format !== (decoded.mimeType === 'image/png' ? 'png' : 'jpeg') ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > 4096 ||
        metadata.height > 4096 ||
        (metadata.pages ?? 1) !== 1
      ) {
        return false;
      }
      await decoder.raw().toBuffer();
      return true;
    } catch {
      return false;
    }
  }

  return decodeRegistrationEvidence(value)?.kind === 'pdf';
}
