import 'reflect-metadata';
import {
  type ExecutionContext,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoansController } from '../src/modules/loans/presentation/controllers/loans.controller.js';
import { UploadLoanEvidenceDto } from '../src/modules/loans/presentation/dto/upload-loan-evidence.dto.js';
import { AuthGuard } from '../src/modules/auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../src/modules/auth/presentation/guards/roles.guard.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';

vi.mock('dotenv/config', () => ({}));
const loanId = '123e4567-e89b-42d3-a456-000000000001';
const evidence = [{ id: 'evidence', url: 'local-test-url' }];

describe('Loan evidence HTTP contract, local Nest with storage/use-case doubles', () => {
  let app: INestApplication;
  let owner: string;
  let upload: {
    execute: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    owner = 'owner';
    upload = {
      execute: vi.fn().mockResolvedValue(evidence),
      list: vi.fn().mockResolvedValue(evidence),
    };
    const tokens = Array.from(
      { length: 12 },
      (_, i) => `evidence-http-dependency-${i}`,
    );
    Reflect.defineMetadata('design:paramtypes', tokens, LoansController);
    Reflect.defineMetadata(
      'design:paramtypes',
      [String, UploadLoanEvidenceDto, Array, Object],
      LoansController.prototype,
      'uploadEvidence',
    );
    const instances = tokens.map(() => ({}));
    instances[1] = {
      execute: vi.fn().mockImplementation(async () => ({ userId: owner })),
    };
    instances[8] = upload;
    const module = await Test.createTestingModule({
      controllers: [LoansController],
      providers: tokens.map((provide, i) => ({
        provide,
        useValue: instances[i],
      })),
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          req.user = {
            accountId: 'actor-account',
            userId: 'owner',
            role: req.headers['x-test-role'] ?? AccessRole.USER,
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue(new RolesGuard(new Reflector()))
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
  });

  it.each([AccessRole.OPERATOR, AccessRole.ADMINISTRATOR])(
    'returns actual HTTP 200 for %s multipart upload',
    async (role) => {
      const response = await request(app.getHttpServer())
        .post(`/loans/${loanId}/evidence`)
        .set('x-test-role', role)
        .field('type', 'ENTREGA')
        .attach('files', Buffer.from('isolated-multipart-fixture'), {
          filename: 'fixture.png',
          contentType: 'image/png',
        })
        .expect(200);
      expect(response.body).toEqual(evidence);
      expect(upload.execute).toHaveBeenCalledWith({
        loanId,
        type: 'ENTREGA',
        description: undefined,
        accountId: 'actor-account',
        files: [
          expect.objectContaining({
            originalname: 'fixture.png',
            mimetype: 'image/png',
            buffer: Buffer.from('isolated-multipart-fixture'),
          }),
        ],
      });
    },
  );
  it('denies USER uploads with the real role guard', async () => {
    await request(app.getHttpServer())
      .post(`/loans/${loanId}/evidence`)
      .field('type', 'ENTREGA')
      .expect(403);
    expect(upload.execute).not.toHaveBeenCalled();
  });
  it('allows own evidence queries but denies another holder before listing', async () => {
    await request(app.getHttpServer())
      .get(`/loans/${loanId}/evidence`)
      .expect(200, evidence);
    expect(upload.list).toHaveBeenCalledExactlyOnceWith(loanId);
    upload.list.mockClear();
    owner = 'other-holder';
    await request(app.getHttpServer())
      .get(`/loans/${loanId}/evidence`)
      .expect(403);
    expect(upload.list).not.toHaveBeenCalled();
  });
  it.each([AccessRole.OPERATOR, AccessRole.ADMINISTRATOR])(
    'allows %s to query another holder',
    async (role) => {
      owner = 'other-holder';
      await request(app.getHttpServer())
        .get(`/loans/${loanId}/evidence`)
        .set('x-test-role', role)
        .expect(200, evidence);
      expect(upload.list).toHaveBeenCalledExactlyOnceWith(loanId);
    },
  );
});
