import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { inMemoryPrisma } from '../../../../../test/helpers/in-memory-prisma.js';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import type { SupabaseStorageService } from '../../../../shared/infrastructure/storage/supabase-storage.service.js';
import type { LoanRepository } from '../../domain/repositories/loan.repository.js';
import { LoanEvidenceType } from '../../presentation/dto/upload-loan-evidence.dto.js';
import { UploadLoanEvidenceUseCase } from './upload-loan-evidence.use-case.js';

vi.mock('dotenv/config', () => ({}));
const marker = 'TECHNICAL_SECRET_MARKER';
const png = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489',
  'hex',
);
const file = (buffer = png, mimetype = 'image/png') =>
  ({
    buffer,
    size: buffer.length,
    mimetype,
    originalname: 'image.png',
  }) as Express.Multer.File;

function harness() {
  const db = inMemoryPrisma();
  const runtime = db.client.runtime();
  const query = runtime.query.bind(runtime);
  vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
    const rows = await query(plan);
    return rows.map((row) => ({
      ...row,
      createdAt: Temporal.Instant.from('2026-11-01T00:00:00Z'),
    }));
  });
  const transaction = vi.spyOn(db.client, 'transaction');
  const loans = { findById: vi.fn().mockResolvedValue({ id: 'loan' }) };
  const storage = {
    upload: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    createSignedUrl: vi
      .fn()
      .mockImplementation(async (path: string) => `signed:${path}`),
  };
  const useCase = new UploadLoanEvidenceUseCase(
    loans as unknown as LoanRepository,
    db as unknown as PrismaService,
    storage as unknown as SupabaseStorageService,
  );
  const input = {
    loanId: 'loan',
    accountId: 'account',
    type: LoanEvidenceType.ENTREGA,
    description: ' entrega ',
    files: [file(), file()],
  };
  return { db, runtime, transaction, loans, storage, useCase, input };
}

afterEach(() => vi.restoreAllMocks());
describe('Loan evidence atomic batch (isolated SQL and storage doubles)', () => {
  it('uploads and signs the whole batch before one transaction, then returns persisted metadata', async () => {
    const h = harness();
    h.transaction.mockImplementationOnce(async (work) => {
      expect(h.storage.upload).toHaveBeenCalledTimes(2);
      expect(h.storage.createSignedUrl).toHaveBeenCalledTimes(2);
      return work(h.runtime);
    });
    const result = await h.useCase.execute(h.input);
    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(h.db.rows('evidencias_prestamo')).toHaveLength(2);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      loanId: 'loan',
      uploadedByAccountId: 'account',
      description: 'entrega',
      sizeBytes: png.length,
      hash: createHash('sha256').update(png).digest('hex'),
      createdAt: new Date('2026-11-01T00:00:00Z'),
    });
    expect(result[0].url).toBe(
      `signed:${h.db.rows('evidencias_prestamo')[0].ruta}`,
    );
    expect(h.storage.createSignedUrl).toHaveBeenCalledTimes(2);
    expect(h.storage.remove).not.toHaveBeenCalled();
  });

  it.each(['second-upload', 'second-insert', 'signing'] as const)(
    'compensates %s without leaving rows or exposing internals',
    async (failure) => {
      const h = harness();
      const log = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      if (failure === 'second-upload')
        h.storage.upload
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error(marker));
      if (failure === 'signing')
        h.storage.createSignedUrl
          .mockResolvedValueOnce('signed:first')
          .mockRejectedValueOnce(new Error(marker));
      if (failure === 'second-insert') {
        const original = vi.mocked(h.runtime.query).getMockImplementation()!;
        vi.mocked(h.runtime.query)
          .mockImplementationOnce(original)
          .mockRejectedValueOnce(new Error(marker));
      }
      await expect(h.useCase.execute(h.input)).rejects.toThrow(
        'No se pudo guardar la evidencia.',
      );
      expect(h.db.rows('evidencias_prestamo')).toEqual([]);
      expect(h.storage.remove.mock.calls.map(([path]) => path)).toEqual(
        h.storage.upload.mock.calls
          .slice(0, failure === 'second-upload' ? 1 : 2)
          .map(([path]) => path),
      );
      if (failure !== 'second-insert')
        expect(h.transaction).not.toHaveBeenCalled();
      expect(JSON.stringify(log.mock.calls)).not.toContain(marker);
    },
  );

  it('logs failed compensation safely and retains the generic original public failure', async () => {
    const h = harness();
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    h.storage.createSignedUrl.mockRejectedValue(new Error(marker));
    h.storage.remove.mockRejectedValue(new Error('signed-url-and-secret'));
    const error = await h.useCase
      .execute(h.input)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as InternalServerErrorException).getResponse()).toMatchObject(
      { message: 'No se pudo guardar la evidencia.' },
    );
    expect(log).toHaveBeenCalledWith('loan-evidence: compensation-failed');
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /TECHNICAL_SECRET_MARKER|signed-url-and-secret/,
    );
  });

  it('never removes committed objects if response mapping fails', async () => {
    const h = harness();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.mocked(h.runtime.query).mockResolvedValue([
      { id: 'persisted', ruta: 'path', createdAt: null },
    ]);
    await expect(h.useCase.execute(h.input)).rejects.toThrow(
      'No se pudo guardar la evidencia.',
    );
    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(h.storage.remove).not.toHaveBeenCalled();
  });

  it.each([
    ['arbitrary PNG', file(Buffer.from('not an image'))],
    ['empty', file(Buffer.alloc(0))],
    ['missing buffer', { ...file(), buffer: undefined }],
    ['wrong MIME', file(png, 'image/jpeg')],
    ['unsupported MIME', file(png, 'text/plain')],
    ['truncated PNG', file(png.subarray(0, 20))],
    [
      'zero PNG dimensions',
      file(Buffer.concat([png.subarray(0, 16), Buffer.alloc(17)])),
    ],
    [
      'oversized real buffer with fake size',
      { ...file(Buffer.alloc(5 * 1024 * 1024 + 1)), size: 1 },
    ],
    ['inconsistent size', { ...file(), size: 1 }],
    [
      'invalid WebP length',
      file(
        Buffer.from('524946460000000057454250565038200100000000', 'hex'),
        'image/webp',
      ),
    ],
    ['truncated JPEG', file(Buffer.from([255, 216, 255, 0]), 'image/jpeg')],
  ])('rejects %s before any upload or transaction', async (_name, invalid) => {
    const h = harness();
    h.input.files = [file(), invalid as Express.Multer.File];
    await expect(h.useCase.execute(h.input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(h.storage.upload).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it.each([0, 11])(
    'rejects a batch of %s files at use-case level',
    async (count) => {
      const h = harness();
      h.input.files = Array.from({ length: count }, () => file());
      await expect(h.useCase.execute(h.input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(h.storage.upload).not.toHaveBeenCalled();
    },
  );

  it.each([
    file(Buffer.from([255, 216, 255, 217]), 'image/jpeg'),
    file(
      Buffer.from('524946460e000000574542505650384c010000000000', 'hex'),
      'image/webp',
    ),
  ])('accepts supported basic signatures', async (image) => {
    const h = harness();
    h.input.files = [image];
    await expect(h.useCase.execute(h.input)).resolves.toHaveLength(1);
  });

  it('preserves missing-loan domain errors', async () => {
    const h = harness();
    h.loans.findById.mockResolvedValue(null);
    await expect(h.useCase.execute(h.input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(h.storage.upload).not.toHaveBeenCalled();
  });
});
