import { InternalServerErrorException, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseStorageService } from './supabase-storage.service.js';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { from: () => mocks } }),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Supabase storage public failures (mocked SDK, no network)', () => {
  it.each([
    ['upload', false],
    ['remove', false],
    ['createSignedUrl', false],
    ['upload', true],
    ['remove', true],
    ['createSignedUrl', true],
  ] as const)(
    'does not expose SDK internals for %s (rejected=%s)',
    async (operation, rejected) => {
      vi.stubEnv('SUPABASE_URL', 'https://storage.invalid');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'isolated-test-only');
      const log = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      if (rejected)
        mocks[operation].mockRejectedValue(
          new Error('TECHNICAL_SECRET_MARKER'),
        );
      else
        mocks[operation].mockResolvedValue({
          error: { message: 'TECHNICAL_SECRET_MARKER' },
          data: null,
        });
      const service = new SupabaseStorageService();
      const result =
        operation === 'upload'
          ? service.upload('path', {
              buffer: Buffer.from('image'),
              mimetype: 'image/png',
            } as Express.Multer.File)
          : service[operation]('path');
      const error = await result.catch((error: unknown) => error);
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(
        JSON.stringify((error as InternalServerErrorException).getResponse()),
      ).not.toContain('TECHNICAL_SECRET_MARKER');
      expect(log).toHaveBeenCalled();
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        'TECHNICAL_SECRET_MARKER',
      );
    },
  );

  it('rejects an absent signed URL without exposing internal details', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://storage.invalid');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'isolated-test-only');
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: null });
    await expect(
      new SupabaseStorageService().createSignedUrl('path'),
    ).rejects.toThrow('No se pudo generar el acceso a la evidencia.');
  });
});
