import { describe, expect, it } from 'vitest';
import {
  decodeRegistrationEvidence,
  isRegistrationEvidence,
} from './registration-evidence.js';

describe('registration evidence validation', () => {
  it('accepts a minimal PDF data URL', async () => {
    const bytes = Buffer.from('%PDF-1.4\n%%EOF\n');
    const source = `data:application/pdf;base64,${bytes.toString('base64')}`;
    expect(decodeRegistrationEvidence(source)?.kind).toBe('pdf');
    await expect(isRegistrationEvidence(source)).resolves.toBe(true);
  });

  it('rejects PDF data URLs with the wrong signature', async () => {
    const source = `data:application/pdf;base64,${Buffer.from('not-a-pdf%%EOF').toString('base64')}`;
    expect(decodeRegistrationEvidence(source)).toBeNull();
    await expect(isRegistrationEvidence(source)).resolves.toBe(false);
  });

  it('does not accept a PDF URL or arbitrary text', async () => {
    await expect(
      isRegistrationEvidence('https://example.com/constancia.pdf'),
    ).resolves.toBe(false);
  });
});
