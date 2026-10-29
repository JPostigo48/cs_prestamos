import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { GoogleIdentityAdapter } from './infrastructure/security/google-identity.adapter.js';
import { GoogleAuthenticationUseCase } from './application/use-cases/google-authentication.use-case.js';
import { AccessRole } from './domain/entities/access-account.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const configure = () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'isolated-client');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'isolated-placeholder');
  vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://localhost:5173/login/google');
};
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const key = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'test-key',
  use: 'sig',
};

function flow(
  overrides: Record<string, unknown> = {},
  signingKey = privateKey,
) {
  configure();
  const provider = new GoogleIdentityAdapter();
  const start = provider.authorize('user@unsa.edu.pe');
  const url = new URL(start.authorizationUrl);
  const claims = {
    sub: 'google-subject',
    email: 'user@unsa.edu.pe',
    email_verified: true,
    hd: 'unsa.edu.pe',
    nonce: url.searchParams.get('nonce'),
    aud: 'isolated-client',
    iss: 'https://accounts.google.com',
    exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides,
  };
  const token = jwt.sign(claims, signingKey, {
    algorithm: 'RS256',
    keyid: 'test-key',
  });
  const fetcher = vi.fn(async (target: string) =>
    Response.json(
      target.endsWith('/token') ? { id_token: token } : { keys: [key] },
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  return {
    provider,
    start,
    url,
    fetcher,
    exchange: () =>
      provider.exchange(
        'single-code',
        url.searchParams.get('state')!,
        start.browserToken,
      ),
  };
}

describe('Google OIDC real signature verification, isolated HTTP doubles', () => {
  it('rejects missing/unsafe configuration without a fake authorization or external request', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    expect(() =>
      new GoogleIdentityAdapter().authorize('user@unsa.edu.pe'),
    ).toThrow('no está configurado');
    configure();
    vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://example.invalid/login/google');
    expect(() =>
      new GoogleIdentityAdapter().authorize('user@unsa.edu.pe'),
    ).toThrow('no está configurado');
  });
  it('uses state, nonce and PKCE, checks signature and consumes authorization once', async () => {
    const f = flow();
    expect(f.url.hostname).toBe('accounts.google.com');
    expect(f.url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(f.url.searchParams.get('scope')).toBe('openid email');
    await expect(f.exchange()).resolves.toEqual({
      subject: 'google-subject',
      email: 'user@unsa.edu.pe',
    });
    const body = new URLSearchParams(
      (f.fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as URLSearchParams,
    );
    expect(body.get('code_verifier')).toHaveLength(43);
    expect(body.get('grant_type')).toBe('authorization_code');
    await expect(f.exchange()).rejects.toThrow('caducó');
  });
  it.each([
    { email_verified: false },
    { hd: 'evil.invalid' },
    { aud: 'other-client' },
    { iss: 'https://evil.invalid' },
    { nonce: 'other-nonce' },
    { exp: 1 },
    { email: 'user@evil.invalid' },
    { azp: 'other-client' },
  ])('rejects invalid verified claims %j', async (claims) => {
    await expect(flow(claims).exchange()).rejects.toThrow(
      'identidad institucional válida',
    );
  });
  it('rejects a token signed by another RSA key', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    await expect(flow({}, other.privateKey).exchange()).rejects.toThrow(
      'identidad institucional válida',
    );
  });
  it('rejects mismatching browser cookie and expired state before contacting Google', async () => {
    const f = flow();
    await expect(
      f.provider.exchange(
        'code',
        f.url.searchParams.get('state')!,
        'wrong-cookie',
      ),
    ).rejects.toThrow('navegador');
    expect(f.fetcher).not.toHaveBeenCalled();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 301_000);
    try {
      await expect(f.exchange()).rejects.toThrow('caducó');
    } finally {
      vi.restoreAllMocks();
    }
  });
  it('rejects missing, disabled or unaffiliated accounts; never creates a public account', async () => {
    const account = {
      id: 'account',
      userId: 'user',
      email: 'user@unsa.edu.pe',
      role: AccessRole.USER,
      enabled: true,
    };
    const accounts = {
      findByEmail: vi.fn().mockResolvedValue(null),
      recordAccess: vi.fn(),
    };
    const users = {
      getById: vi
        .fn()
        .mockResolvedValue({
          userId: 'user',
          userType: 'ESTUDIANTE',
          currentAffiliation: true,
        }),
    };
    const google = {
      exchange: vi
        .fn()
        .mockResolvedValue({ email: account.email, subject: 'verified' }),
    };
    const useCase = new GoogleAuthenticationUseCase(
      google as any,
      accounts as any,
      users as any,
    );
    await expect(useCase.execute('code', 'state', 'cookie')).rejects.toThrow(
      'cuenta habilitada',
    );
    accounts.findByEmail.mockResolvedValue({
      ...account,
      enabled: false,
    } as any);
    await expect(useCase.execute('code', 'state', 'cookie')).rejects.toThrow(
      'cuenta habilitada',
    );
    accounts.findByEmail.mockResolvedValue(account as any);
    users.getById.mockResolvedValue({
      userId: 'user',
      userType: 'ESTUDIANTE',
      currentAffiliation: false,
    });
    await expect(useCase.execute('code', 'state', 'cookie')).rejects.toThrow(
      'vinculación',
    );
    users.getById.mockResolvedValue({
      userId: 'user',
      userType: 'ESTUDIANTE',
      currentAffiliation: true,
    });
    await expect(
      useCase.execute('code', 'state', 'cookie'),
    ).resolves.toMatchObject({ identity: { role: AccessRole.USER } });
    expect(accounts.recordAccess).toHaveBeenCalledOnce();
  });
});
