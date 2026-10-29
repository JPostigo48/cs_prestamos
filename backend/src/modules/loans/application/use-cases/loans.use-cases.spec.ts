import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ReturnLoanUseCase } from './return-loan.use-case.js';

const startsAt = new Date(Date.now() + 60_000);
const loan = {
  id: 'loan-1',
  userId: 'user-1',
  copyId: 'copy-1',
  startsAt,
  endsAt: new Date(startsAt.getTime() + 86_400_000),
  status: 'ACTIVO' as const,
  return: null,
};

describe('Loans use cases', () => {
  it('returns an active loan and releases the copy', async () => {
    const completed = {
      ...loan,
      status: 'FINALIZADO',
      return: { returnedAt: new Date() },
    };
    const loans = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(loan)
        .mockResolvedValueOnce(completed),
      registerReturnWithCopy: vi.fn().mockResolvedValue({}),
    };
    const useCase = new ReturnLoanUseCase(loans as any);

    await expect(
      useCase.execute({
        loanId: loan.id,
        returnedAt: new Date(startsAt.getTime() + 3_600_000),
        observation: 'Sin daños',
      }),
    ).resolves.toEqual(completed);
    expect(loans.registerReturnWithCopy).toHaveBeenCalled();
  });

  it('never returns a stale success if the persisted return cannot be confirmed', async () => {
    const loans = {
      findById: vi.fn().mockResolvedValue(loan),
      registerReturnWithCopy: vi.fn().mockResolvedValue({}),
    };
    await expect(
      new ReturnLoanUseCase(loans as any).execute({
        loanId: loan.id,
        returnedAt: new Date(startsAt.getTime() + 1),
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('rejects missing or already completed loans', async () => {
    const loans = { findById: vi.fn().mockResolvedValue(null) };
    const useCase = new ReturnLoanUseCase(loans as any);
    await expect(
      useCase.execute({ loanId: 'missing', returnedAt: new Date() }),
    ).rejects.toThrow(NotFoundException);

    loans.findById.mockResolvedValue({ ...loan, status: 'FINALIZADO' });
    await expect(
      useCase.execute({ loanId: loan.id, returnedAt: new Date() }),
    ).rejects.toThrow(ConflictException);
  });
});
