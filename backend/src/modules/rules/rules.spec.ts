import { describe, expect, it, vi } from 'vitest';
import { AppealStatus } from './domain/entities/appeal.js';
import { RegisterViolationUseCase } from './application/use-cases/register-violation.use-case.js';
import { SubmitAppealUseCase } from './application/use-cases/submit-appeal.use-case.js';
import { ResolveAppealUseCase } from './application/use-cases/resolve-appeal.use-case.js';
import { AcceptTermsVersionUseCase } from './application/use-cases/accept-terms-version.use-case.js';
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

  it('prevents duplicate appeals and only allows the sanction owner to submit', async () => {
    const appeals = {
      findSanctionByViolationId: vi.fn().mockResolvedValue({
        id: 's1', userId: 'u1', status: 'ACTIVA', startsAt: new Date(), endsAt: null,
      }),
      findByViolationId: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'a1' }),
    };
    const violations = { findById: vi.fn().mockResolvedValue({ id: 'v1', userId: 'u1' }) };
    const useCase = new SubmitAppealUseCase(appeals as any, violations as any);
    await expect(useCase.execute({ violationId: 'v1', userId: 'u2', reason: 'x', submittedAt: new Date() })).rejects.toThrow();
    await expect(useCase.execute({ violationId: 'v1', userId: 'u1', reason: 'x', submittedAt: new Date() })).resolves.toBeDefined();
    expect(appeals.create).toHaveBeenCalledWith(expect.objectContaining({ violationId: 'v1', userId: 'u1' }));
    appeals.findByViolationId.mockResolvedValue({ id: 'a1' });
    await expect(useCase.execute({ violationId: 'v1', userId: 'u1', reason: 'x', submittedAt: new Date() })).rejects.toThrow();
  });

  it('rejects an appeal more than 30 days after the sanction ended', async () => {
    const appeals = {
      findSanctionByViolationId: vi.fn().mockResolvedValue({
        id: 's1', userId: 'u1', status: 'FINALIZADA',
        startsAt: new Date('2026-08-01T00:00:00Z'), endsAt: new Date('2026-08-10T00:00:00Z'),
      }),
      findByViolationId: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    };
    const useCase = new SubmitAppealUseCase(appeals as any, {
      findById: vi.fn().mockResolvedValue({ id: 'v1', userId: 'u1' }),
    } as any);
    await expect(useCase.execute({
      violationId: 'v1', userId: 'u1', reason: 'fuera de plazo',
      submittedAt: new Date('2026-08-10T00:00:00Z'),
    })).rejects.toThrow('plazo');
    expect(appeals.create).not.toHaveBeenCalled();
  });

  it('requires a sanction and permits an appeal within 30 days after finalization', async () => {
    const appeals = {
      findSanctionByViolationId: vi.fn().mockResolvedValue(null),
      findByViolationId: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'a1' }),
    };
    const useCase = new SubmitAppealUseCase(appeals as any, {
      findById: vi.fn().mockResolvedValue({ id: 'v1', userId: 'u1' }),
    } as any);
    const input = { violationId: 'v1', userId: 'u1', reason: 'revisión', submittedAt: new Date(0) };
    await expect(useCase.execute(input)).rejects.toThrow('Sanción no encontrada');
    appeals.findSanctionByViolationId.mockResolvedValue({
      id: 's1', userId: 'u1', status: 'FINALIZADA',
      startsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    await expect(useCase.execute(input)).resolves.toEqual({ id: 'a1' });
    expect(appeals.create.mock.calls[0][0].submittedAt.getTime()).toBeGreaterThan(0);
  });

  it('resolves pending appeals and rejects already resolved appeals', async () => {
    const appeals = { findById: vi.fn().mockResolvedValue({ id: 'a1', status: 'PENDIENTE' }), resolve: vi.fn().mockResolvedValue({ id: 'a1', status: AppealStatus.ACCEPTED }) };
    const useCase = new ResolveAppealUseCase(appeals as any);
    await expect(useCase.execute({ appealId: 'a1', status: AppealStatus.ACCEPTED, resolution: 'ok', resolvedAt: new Date(), resolvedByAccountId: 'a' })).resolves.toMatchObject({ status: AppealStatus.ACCEPTED });
    appeals.findById.mockResolvedValue({ id: 'a1', status: AppealStatus.ACCEPTED });
    await expect(useCase.execute({ appealId: 'a1', status: AppealStatus.REJECTED, resolution: 'no', resolvedAt: new Date(), resolvedByAccountId: 'a' })).rejects.toThrow();
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
      .mockResolvedValueOnce([{
        id: 's1', usuarioId: 'u1', estado: 'FINALIZADA',
        confianzaAnterior: '60.00', confianzaPosterior: '45.00',
      }])
      .mockResolvedValueOnce([{ id: 'u1', confianza: '55.00' }])
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce([{ id: 'u1' }])
      .mockResolvedValueOnce([{ id: 'audit-1' }]);
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
        sanciones: { select: () => chain('sanction-select'), update: () => chain('sanction-update') },
        usuarios: { select: () => chain('user-select'), update: () => chain('user-update') },
        auditorias_usuario: { insert: () => chain('audit-insert') },
      } },
    };
    const repository = new PrismaAppealRepository(prisma as any);
    const result = await repository.resolve({
      appealId: 'a1',
      status: AppealStatus.ACCEPTED,
      resolution: 'fundada',
      resolvedAt: new Date(),
      resolvedByAccountId: 'account-1',
    });

    expect(result.status).toBe('ACEPTADA');
    expect(prisma.client.transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(6);
    expect(query).toHaveBeenCalledWith('audit-insert');
  });

  it('rolls back an accepted appeal when the sanction no longer exists', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{
        id: 'a1', incumplimientoId: 'v1', usuarioId: 'u1', estado: 'ACEPTADA',
      }])
      .mockResolvedValueOnce([]);
    const chain = (value: unknown): any => ({
      where: () => chain(value), limit: () => chain(value),
      returning: () => chain(value), build: () => value,
    });
    const prisma = {
      client: { transaction: vi.fn(async (callback: any) => callback({ query })) },
      sql: { public: {
        apelaciones: { update: () => chain('appeal-update') },
        sanciones: { select: () => chain('sanction-select') },
      } },
    };
    const repository = new PrismaAppealRepository(prisma as any);
    await expect(repository.resolve({
      appealId: 'a1', status: AppealStatus.ACCEPTED, resolution: 'fundada',
      resolvedAt: new Date(), resolvedByAccountId: 'admin-1',
    })).rejects.toThrow('sanción');
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
      resolve: vi.fn().mockResolvedValue({ id: 'a1', status: AppealStatus.ACCEPTED }),
    };
    const useCase = new ResolveAppealUseCase(appeals as any);
    await useCase.execute({
      appealId: 'a1',
      status: AppealStatus.ACCEPTED,
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
