import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CreateLoanUseCase } from './create-loan.use-case.js';
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
  it('creates a loan for the authenticated user after eligibility and availability checks', async () => {
    const loans = {
      hasOverlappingLoan: vi.fn().mockResolvedValue(false),
      createWithCopy: vi.fn().mockResolvedValue(loan),
    };
    const inventory = {
      getAvailability: vi.fn().mockResolvedValue({
        copyId: 'copy-1',
        available: true,
        maximumLoanDays: 1,
      }),
      markAsLoaned: vi.fn().mockResolvedValue(undefined),
      releaseAfterReturn: vi.fn(),
    };
    const useCase = new CreateLoanUseCase(
      loans as any,
      { getByUserId: vi.fn().mockResolvedValue({ userId: 'user-1', enabled: true }) } as any,
      inventory as any,
    );

    await expect(useCase.execute({ userId: 'user-1', copyId: 'copy-1', startsAt })).resolves.toEqual(loan);
    expect(loans.createWithCopy).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', copyId: 'copy-1' }));
  });

  it('rejects ineligible users and unavailable or overlapping copies', async () => {
    const inventory = {
      getAvailability: vi.fn().mockResolvedValue({ available: false }),
    };
    const useCase = new CreateLoanUseCase(
      { hasOverlappingLoan: vi.fn() } as any,
      { getByUserId: vi.fn().mockResolvedValue({ userId: 'user-1', enabled: false }) } as any,
      inventory as any,
    );
    await expect(useCase.execute({ userId: 'user-1', copyId: 'copy-1', startsAt })).rejects.toThrow(ConflictException);

    const eligible = new CreateLoanUseCase(
      { hasOverlappingLoan: vi.fn().mockResolvedValue(true) } as any,
      { getByUserId: vi.fn().mockResolvedValue({ userId: 'user-1', enabled: true }) } as any,
      { getAvailability: vi.fn().mockResolvedValue({ available: true, maximumLoanDays: 1 }) } as any,
    );
    await expect(eligible.execute({ userId: 'user-1', copyId: 'copy-1', startsAt })).rejects.toThrow(ConflictException);
  });

  it('returns an active loan and releases the copy', async () => {
    const loans = {
      findById: vi.fn().mockResolvedValue(loan),
      registerReturnWithCopy: vi.fn().mockResolvedValue({}),
    };
    const useCase = new ReturnLoanUseCase(loans as any);

    await expect(useCase.execute({
      loanId: loan.id,
      returnedAt: new Date(startsAt.getTime() + 3_600_000),
      observation: 'Sin daños',
    })).resolves.toEqual(loan);
    expect(loans.registerReturnWithCopy).toHaveBeenCalled();
  });

  it('rejects missing or already completed loans', async () => {
    const loans = { findById: vi.fn().mockResolvedValue(null) };
    const useCase = new ReturnLoanUseCase(loans as any);
    await expect(useCase.execute({ loanId: 'missing', returnedAt: new Date() })).rejects.toThrow(NotFoundException);

    loans.findById.mockResolvedValue({ ...loan, status: 'FINALIZADO' });
    await expect(useCase.execute({ loanId: loan.id, returnedAt: new Date() })).rejects.toThrow(ConflictException);
  });
});
