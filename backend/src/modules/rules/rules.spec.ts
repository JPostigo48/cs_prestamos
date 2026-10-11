import { describe, expect, it, vi } from 'vitest';
import { RegisterViolationUseCase } from './application/use-cases/register-violation.use-case.js';
import { SubmitAppealUseCase } from './application/use-cases/submit-appeal.use-case.js';
import { ResolveAppealUseCase } from './application/use-cases/resolve-appeal.use-case.js';
import { AcceptTermsVersionUseCase } from './application/use-cases/accept-terms-version.use-case.js';

describe('Rules use cases', () => {
  it('registers a violation using the current active version and applies its penalty', async () => {
    const violation = { id: 'v1', userId: 'u1', ruleId: 'r1', ruleVersionId: 'rv1', occurredAt: new Date(), appliedPenalty: 10 };
    const violations = { create: vi.fn().mockResolvedValue(violation) };
    const users = { applyPenalty: vi.fn().mockResolvedValue(undefined) };
    const useCase = new RegisterViolationUseCase(
      violations as any,
      { findById: vi.fn().mockResolvedValue({ id: 'r1', currentVersionId: 'rv1', versions: [{ id: 'rv1', status: 'ACTIVA', penaltyPercentage: 10 }] }) } as any,
      users as any,
    );
    await expect(useCase.execute({ userId: 'u1', ruleId: 'r1', occurredAt: violation.occurredAt })).resolves.toEqual(violation);
    expect(users.applyPenalty).toHaveBeenCalledWith(expect.objectContaining({ violationId: 'v1', penaltyPercentage: 10 }));
  });

  it('prevents duplicate appeals and only allows the violation owner to submit', async () => {
    const appeals = { findByViolationId: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'a1' }) };
    const violations = { findById: vi.fn().mockResolvedValue({ id: 'v1', userId: 'u1' }) };
    const useCase = new SubmitAppealUseCase(appeals as any, violations as any);
    await expect(useCase.execute({ violationId: 'v1', userId: 'u2', reason: 'x', submittedAt: new Date() })).rejects.toThrow();
    await expect(useCase.execute({ violationId: 'v1', userId: 'u1', reason: 'x', submittedAt: new Date() })).resolves.toBeDefined();
  });

  it('resolves pending appeals and rejects already resolved appeals', async () => {
    const appeals = { findById: vi.fn().mockResolvedValue({ id: 'a1', status: 'PENDIENTE' }), resolve: vi.fn().mockResolvedValue({ id: 'a1', status: 'ACEPTADA' }) };
    const useCase = new ResolveAppealUseCase(appeals as any);
    await expect(useCase.execute({ appealId: 'a1', status: 'ACEPTADA', resolution: 'ok', resolvedAt: new Date(), resolvedByAccountId: 'a' })).resolves.toMatchObject({ status: 'ACEPTADA' });
    appeals.findById.mockResolvedValue({ id: 'a1', status: 'ACEPTADA' });
    await expect(useCase.execute({ appealId: 'a1', status: 'RECHAZADA', resolution: 'no', resolvedAt: new Date(), resolvedByAccountId: 'a' })).rejects.toThrow();
  });

  it('accepts an existing terms version', async () => {
    const terms = { findVersionById: vi.fn().mockResolvedValue({ id: 't1' }), accept: vi.fn().mockResolvedValue({ id: 'a1' }) };
    const useCase = new AcceptTermsVersionUseCase(terms as any);
    await expect(useCase.execute({ userId: 'u1', termsVersionId: 't1', acceptedAt: new Date() })).resolves.toEqual({ id: 'a1' });
    expect(terms.accept).toHaveBeenCalled();
  });
});
