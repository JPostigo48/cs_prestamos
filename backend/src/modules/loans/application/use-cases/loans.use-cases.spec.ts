import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ReturnLoanUseCase } from './return-loan.use-case.js';
import type { LoanRepository } from '../../domain/repositories/loan.repository.js';
import type { ReturnLoanInput } from '../ports/loans.inputs.js';

const input: ReturnLoanInput = {
  loanId: 'loan',
  requestId: '123e4567-e89b-42d3-a456-426614174001',
  actor: { accountId: 'account', userId: 'operator' },
  inspection: { parts: [], condition: 'SANO', evidenceIds: [] },
};
describe('ReturnLoanUseCase: único puerto integral e idempotente', () => {
  it('devuelve el resultado transaccional sin lectura previa ni posterior que rompa reintentos', async () => {
    const result = {
      id: 'loan',
      status: 'FINALIZADO',
      closure: { requestId: input.requestId },
    };
    const loans = { closeLoan: vi.fn().mockResolvedValue(result) };
    const useCase = new ReturnLoanUseCase(loans as unknown as LoanRepository);
    await expect(useCase.execute(input)).resolves.toEqual(result);
    await expect(useCase.execute(input)).resolves.toEqual(result);
    expect(loans.closeLoan).toHaveBeenCalledWith(input);
  });
  it.each([
    new NotFoundException(),
    new ConflictException(),
    new Error('rollback'),
  ])('propaga el fallo del cierre sin éxito parcial', async (error) => {
    const loans = { closeLoan: vi.fn().mockRejectedValue(error) };
    await expect(
      new ReturnLoanUseCase(loans as unknown as LoanRepository).execute(input),
    ).rejects.toBe(error);
  });
});
