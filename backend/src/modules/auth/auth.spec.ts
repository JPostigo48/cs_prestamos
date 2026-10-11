import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticateAccountUseCase } from './application/use-cases/authenticate-account.use-case.js';
import { RegisterAccessAccountUseCase } from './application/use-cases/register-access-account.use-case.js';
import { UpdateAccessAccountUseCase } from './application/use-cases/update-access-account.use-case.js';
import { AccessRole } from './domain/entities/access-account.js';
import { InstitutionalEmailPolicy } from './domain/policies/institutional-email.policy.js';
import { PendingCredentialsAdapter } from './infrastructure/security/pending-credentials.adapter.js';
import { JwtTokenAdapter } from './infrastructure/security/jwt-token.adapter.js';

const user = {
  userId: 'user-1',
  userType: 'ESTUDIANTE' as const,
  currentAffiliation: true,
};

const account = {
  id: 'account-1',
  userId: 'user-1',
  email: 'estudiante@unsa.edu.pe',
  passwordHash: 'hash',
  role: AccessRole.USER,
  enabled: true,
  lastAccessAt: null,
};

describe('Auth', () => {
  it('normalizes institutional email and rejects external domains', () => {
    expect(InstitutionalEmailPolicy.assertValid('  ESTUDIANTE@UNSA.EDU.PE ')).toBe(
      'estudiante@unsa.edu.pe',
    );
    expect(() => InstitutionalEmailPolicy.assertValid('user@gmail.com')).toThrow();
    expect(() =>
      InstitutionalEmailPolicy.assertValid('user@subdominio.unsa.edu.pe'),
    ).toThrow();
  });

  it('hashes and verifies passwords with Argon2id', async () => {
    const credentials = new PendingCredentialsAdapter();
    const hash = await credentials.hash('correct-password');
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(credentials.matches('correct-password', hash)).resolves.toBe(true);
    await expect(credentials.matches('wrong-password', hash)).resolves.toBe(false);
  });

  it('registers only an approved and current user with the default role', async () => {
    const accounts = {
      findByUserId: vi.fn().mockResolvedValue(null),
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(account),
    };
    const users = { getById: vi.fn().mockResolvedValue(user) };
    const credentials = { hash: vi.fn().mockResolvedValue('hash') };
    const useCase = new RegisterAccessAccountUseCase(
      accounts as any,
      users as any,
      credentials as any,
    );

    await useCase.execute({
      userId: user.userId,
      email: ' ESTUDIANTE@UNSA.EDU.PE ',
      password: 'correct-password',
    });
    expect(accounts.create).toHaveBeenCalledWith({
      userId: user.userId,
      email: 'estudiante@unsa.edu.pe',
      passwordHash: 'hash',
      role: AccessRole.USER,
    });
  });

  it('rejects registration for a user without current affiliation or a privileged role', async () => {
    const accounts = {
      findByUserId: vi.fn().mockResolvedValue(null),
      findByEmail: vi.fn().mockResolvedValue(null),
    };
    const users = { getById: vi.fn().mockResolvedValue({ ...user, currentAffiliation: false }) };
    const useCase = new RegisterAccessAccountUseCase(
      accounts as any,
      users as any,
      { hash: vi.fn() } as any,
    );
    await expect(useCase.execute({
      userId: user.userId,
      email: user.email,
      password: 'password',
    })).rejects.toThrow();

    users.getById.mockResolvedValue(user);
    await expect(useCase.execute({
      userId: user.userId,
      email: user.email,
      password: 'password',
      role: AccessRole.ADMINISTRATOR,
    })).rejects.toThrow();
  });

  it('does not reveal whether credentials belong to an account', async () => {
    const accounts = {
      findByEmail: vi.fn().mockResolvedValue(null),
    };
    const useCase = new AuthenticateAccountUseCase(
      accounts as any,
      {} as any,
      {} as any,
    );
    await expect(useCase.execute({
      email: 'missing@unsa.edu.pe',
      password: 'wrong',
    })).rejects.toThrow(UnauthorizedException);
  });

  it('authenticates enabled accounts, records access and rejects disabled accounts', async () => {
    const accounts = {
      findByEmail: vi.fn().mockResolvedValue(account),
      recordAccess: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new AuthenticateAccountUseCase(
      accounts as any,
      { getById: vi.fn().mockResolvedValue(user) } as any,
      { matches: vi.fn().mockResolvedValue(true) } as any,
    );
    await expect(useCase.execute({
      email: account.email,
      password: 'password',
    })).resolves.toMatchObject({
      accountId: account.id,
      userId: user.userId,
      role: AccessRole.USER,
    });
    expect(accounts.recordAccess).toHaveBeenCalledWith(account.id, expect.any(Date));

    accounts.findByEmail.mockResolvedValue({ ...account, enabled: false });
    await expect(useCase.execute({
      email: account.email,
      password: 'password',
    })).rejects.toThrow(UnauthorizedException);
  });

  it('updates account role and enabled status through the administrative use case', async () => {
    const accounts = {
      findById: vi.fn().mockResolvedValue(account),
      update: vi.fn().mockResolvedValue({
        ...account,
        role: AccessRole.OPERATOR,
        enabled: false,
      }),
    };
    const useCase = new UpdateAccessAccountUseCase(accounts as any);
    await expect(useCase.execute({
      accountId: account.id,
      role: AccessRole.OPERATOR,
      enabled: false,
    })).resolves.toMatchObject({
      role: AccessRole.OPERATOR,
      enabled: false,
    });
  });

  it('generates and verifies JWT claims and rejects tampered tokens', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('JWT_SECRET', 'test-secret');
    vi.stubEnv('JWT_EXPIRES_IN', '3600s');
    const jwt = new JwtTokenAdapter();
    const identity = {
      accountId: account.id,
      userId: user.userId,
      userType: user.userType,
      role: AccessRole.USER,
    };
    expect(jwt.verify(jwt.sign(identity))).toEqual(identity);
    expect(() => jwt.verify('invalid-token')).toThrow(UnauthorizedException);
    vi.unstubAllEnvs();
  });
});
