import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApproveRegistrationRequestUseCase } from './approve-registration-request.use-case.js';
import { RejectRegistrationRequestUseCase } from './reject-registration-request.use-case.js';
import { SubmitRegistrationRequestUseCase } from './submit-registration-request.use-case.js';

const pending = {
  id: 'request-1',
  name: 'Ada Lovelace',
  userType: 'ESTUDIANTE' as const,
  institutionalId: 'A-1',
  requestedAt: new Date(),
  status: 'PENDIENTE' as const,
  approvedUserId: null,
  evidence: [],
};

describe('Users registration request use cases', () => {
  it('creates a normalized request and rejects pending duplicates', async () => {
    const repository = {
      findPendingByInstitutionalId: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(pending),
      create: vi.fn().mockResolvedValue(pending),
    };
    const users = { findByInstitutionalId: vi.fn().mockResolvedValue(null) };
    const useCase = new SubmitRegistrationRequestUseCase(repository as any, users as any);

    await useCase.execute({ name: ' Ada Lovelace ', userType: 'ESTUDIANTE', institutionalId: ' A-1 ', evidence: [' carnet '] });
    expect(repository.create).toHaveBeenCalledWith({ name: 'Ada Lovelace', userType: 'ESTUDIANTE', institutionalId: 'A-1', evidence: ['carnet'] });
    await expect(useCase.execute({ name: 'Otra', userType: 'ESTUDIANTE', institutionalId: 'A-1' })).rejects.toThrow(ConflictException);
  });

  it('approves only pending requests through the transactional repository operation', async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(pending),
      approveAndCreateUser: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
    };
    const result = await new ApproveRegistrationRequestUseCase(repository as any).execute({ requestId: 'request-1' });
    expect(result.user).toEqual({ id: 'user-1' });
    expect(repository.approveAndCreateUser).toHaveBeenCalledWith('request-1');
  });

  it('rejects already processed requests and reports missing requests', async () => {
    const repository = { findById: vi.fn().mockResolvedValue({ ...pending, status: 'APROBADA' }) };
    await expect(new RejectRegistrationRequestUseCase(repository as any).execute({ requestId: 'request-1' })).rejects.toThrow(ConflictException);
    repository.findById.mockResolvedValue(null);
    await expect(new RejectRegistrationRequestUseCase(repository as any).execute({ requestId: 'request-1' })).rejects.toThrow(NotFoundException);
  });
});