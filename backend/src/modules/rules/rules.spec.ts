import { describe, expect, it, vi } from 'vitest';
import { RegisterViolationUseCase } from './application/use-cases/register-violation.use-case.js';
import { SubmitAppealUseCase } from './application/use-cases/submit-appeal.use-case.js';
import { ResolveAppealUseCase } from './application/use-cases/resolve-appeal.use-case.js';
import { AcceptTermsVersionUseCase } from './application/use-cases/accept-terms-version.use-case.js';
import { CreateLoanUseCase } from '../loans/application/use-cases/create-loan.use-case.js';
import { isEffectiveActiveSanction, PrismaUserRepository } from '../users/infrastructure/persistence/prisma/prisma-user.repository.js';
import { PrismaAppealRepository } from './infrastructure/persistence/prisma/prisma-appeal.repository.js';

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

  it('unblocks loans only after an accepted appeal absolves the active sanction', async () => {
    let sanctionStatus = 'ACTIVA';
    const appeals = {
      findById: vi.fn().mockResolvedValue({ id: 'a1', status: 'PENDIENTE' }),
      resolve: vi.fn().mockImplementation(async (input: any) => {
        if (input.status === 'ACEPTADA') sanctionStatus = 'ABSUELTA';
        return { id: 'a1', status: input.status };
      }),
    };
    const resolver = new ResolveAppealUseCase(appeals as any);
    const eligibility = () => ({ enabled: sanctionStatus !== 'ACTIVA' });
    const inventory = { getAvailability: vi.fn().mockResolvedValue({ available: true, maximumLoanDays: 1 }) };
    const loans = { hasOverlappingLoan: vi.fn().mockResolvedValue(false), createWithCopy: vi.fn().mockResolvedValue({ id: 'l1' }) };
    const createLoan = () => new CreateLoanUseCase(loans as any, { getByUserId: vi.fn().mockImplementation(eligibility) } as any, inventory as any);
    const input = { userId: 'u1', copyId: 'c1', startsAt: new Date(Date.now() + 60_000) };
    await expect(createLoan().execute(input)).rejects.toThrow();
    await resolver.execute({ appealId: 'a1', status: 'ACEPTADA', resolution: 'fundada', resolvedAt: new Date(), resolvedByAccountId: 'operator-1' });
    await expect(createLoan().execute(input)).resolves.toEqual({ id: 'l1' });
  });

  it('keeps the sanction blocking loans when an appeal is rejected', async () => {
    let sanctionStatus = 'ACTIVA';
    const appeals = {
      findById: vi.fn().mockResolvedValue({ id: 'a1', status: 'PENDIENTE' }),
      resolve: vi.fn().mockImplementation(async (input: any) => ({ id: 'a1', status: input.status })),
    };
    const resolver = new ResolveAppealUseCase(appeals as any);
    await resolver.execute({ appealId: 'a1', status: 'RECHAZADA', resolution: 'infundada', resolvedAt: new Date(), resolvedByAccountId: 'operator-1' });
    expect(sanctionStatus).toBe('ACTIVA');
    const createLoan = new CreateLoanUseCase(
      { hasOverlappingLoan: vi.fn() } as any,
      { getByUserId: vi.fn().mockReturnValue({ enabled: false }) } as any,
      { getAvailability: vi.fn() } as any,
    );
    await expect(createLoan.execute({
      userId: 'u1',
      copyId: 'c1',
      startsAt: new Date(Date.now() + 60_000),
    })).rejects.toThrow();
  });

  it('recognizes only effective active sanctions for eligibility', () => {
    const at = new Date('2026-10-11T12:00:00.000Z');
    const base = { status: 'ACTIVA' as const, startsAt: new Date('2026-10-10T12:00:00.000Z'), endsAt: null };
    expect(isEffectiveActiveSanction(base, at)).toBe(true);
    expect(isEffectiveActiveSanction({ ...base, status: 'ABSUELTA' }, at)).toBe(false);
    expect(isEffectiveActiveSanction({ ...base, status: 'FINALIZADA' }, at)).toBe(false);
    expect(isEffectiveActiveSanction({ ...base, startsAt: new Date('2026-10-12T12:00:00.000Z') }, at)).toBe(false);
    expect(isEffectiveActiveSanction({ ...base, endsAt: new Date('2026-10-11T11:59:59.000Z') }, at)).toBe(false);
  });

  it('resolves appeals and absolves sanctions in one transaction', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{
        id: 'a1', incumplimientoId: 'v1', usuarioId: 'u1', motivo: 'motivo',
        fecha: new Date(), estado: 'ACEPTADA', resolucion: 'fundada',
        fechaResolucion: new Date(), resueltaPorCuentaId: 'account-1',
      }])
      .mockResolvedValueOnce([{ id: 's1' }]);
    const chain = (value: unknown) => ({
      where: () => chain(value),
      limit: () => chain(value),
      returning: () => chain(value),
      build: () => value,
    });

    const prisma = {
      client: { transaction: vi.fn(async (callback: any) => callback({ query })) },
      sql: { public: {
        apelaciones: { update: () => chain('appeal-update') },
        sanciones: { update: () => chain('sanction-update') },
      } },
    };
    const repository = new PrismaAppealRepository(prisma as any);
    const result = await repository.resolve({
      appealId: 'a1',
      status: 'ACEPTADA',
      resolution: 'fundada',
      resolvedAt: new Date(),
      resolvedByAccountId: 'account-1',
    });

    expect(result.status).toBe('ACEPTADA');
    expect(prisma.client.transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('does not write the audit when the trust and sanction transaction rolls back', async () => {
    const chain = (value: unknown) => ({
      where: () => chain(value),
      limit: () => chain(value),
      returning: () => chain(value),
      build: () => value,
    });
    const runtimeQuery = vi.fn().mockResolvedValueOnce([{
      id: 'u1', nombre: 'User', tipoUsuario: 'ESTUDIANTE',
      identificadorInstitucional: 'I1', vinculacionVigente: true, confianza: '100.00',
    }]);
    const transactionQuery = vi.fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('sanction insert failed'));
    const prisma = {
      client: {
        runtime: () => ({ query: runtimeQuery }),
        transaction: vi.fn(async (callback: any) => callback({ query: transactionQuery })),
      },
      sql: { public: {
        usuarios: { select: () => chain('user-select'), update: () => chain('user-update') },
        sanciones: { insert: () => chain('sanction-insert') },
        auditorias_usuario: { insert: () => chain('audit-insert') },
      } },
    };
    const repository = new PrismaUserRepository(prisma as any);
    await expect(repository.applyTrustPenalty({
      userId: 'u1', violationId: 'v1', ruleId: 'r1',
      ruleVersionId: 'rv1', penaltyPercentage: 10,
    })).rejects.toThrow('sanction insert failed');
    expect(prisma.client.transaction).toHaveBeenCalledTimes(1);
    expect(runtimeQuery).toHaveBeenCalledTimes(1);
  });

  it('passes the trusted resolver identity through to the repository', async () => {
    const appeals = {
      findById: vi.fn().mockResolvedValue({ id: 'a1', status: 'PENDIENTE' }),
      resolve: vi.fn().mockResolvedValue({ id: 'a1', status: 'ACEPTADA' }),
    };
    const useCase = new ResolveAppealUseCase(appeals as any);
    await useCase.execute({
      appealId: 'a1',
      status: 'ACEPTADA',
      resolution: 'validada',
      resolvedAt: new Date(),
      resolvedByAccountId: 'account-from-jwt',
    });
    expect(appeals.resolve).toHaveBeenCalledWith(expect.objectContaining({
      resolvedByAccountId: 'account-from-jwt',
    }));
  });

  it('accepts an existing terms version', async () => {
    const terms = { findVersionById: vi.fn().mockResolvedValue({ id: 't1' }), accept: vi.fn().mockResolvedValue({ id: 'a1' }) };
    const useCase = new AcceptTermsVersionUseCase(terms as any);
    await expect(useCase.execute({ userId: 'u1', termsVersionId: 't1', acceptedAt: new Date() })).resolves.toEqual({ id: 'a1' });
    expect(terms.accept).toHaveBeenCalled();
  });
});
