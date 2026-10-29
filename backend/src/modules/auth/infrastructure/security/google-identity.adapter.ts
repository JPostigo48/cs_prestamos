import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  createPublicKey,
  randomBytes,
  type JsonWebKey,
} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  GoogleIdentityPort,
  type GoogleIdentity,
} from '../../application/ports/google-identity.port.js';
import { InstitutionalEmailPolicy } from '../../domain/policies/institutional-email.policy.js';

type PendingAuthorization = {
  verifier: string;
  nonce: string;
  browserToken: string;
  expiresAt: number;
};
type GoogleKey = JsonWebKey & { kid: string };

/** OIDC authorization-code + PKCE, nonce y state de un solo uso ligados al navegador. */
@Injectable()
export class GoogleIdentityAdapter implements GoogleIdentityPort {
  private readonly pending = new Map<string, PendingAuthorization>();

  private config() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const unavailable = () =>
      new ServiceUnavailableException(
        'Google no está configurado. Utilice el acceso con correo y contraseña.',
      );
    if (!clientId || !clientSecret || !redirectUri) throw unavailable();
    let url: URL;
    try {
      url = new URL(redirectUri);
    } catch {
      throw unavailable();
    }
    if (
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname)
        )) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/login/google'
    )
      throw unavailable();
    return {
      clientId,
      clientSecret,
      redirectUri,
      secure: url.protocol === 'https:',
    };
  }

  authorize(email: string) {
    const config = this.config();
    const normalized = InstitutionalEmailPolicy.assertValid(email);
    for (const [state, pending] of this.pending)
      if (pending.expiresAt <= Date.now()) this.pending.delete(state);
    if (this.pending.size >= 1000)
      throw new ServiceUnavailableException(
        'Google está ocupado. Intente más tarde.',
      );
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const browserToken = randomBytes(32).toString('base64url');
    this.pending.set(state, {
      verifier,
      nonce,
      browserToken,
      expiresAt: Date.now() + 300_000,
    });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state,
      nonce,
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      hd: 'unsa.edu.pe',
      login_hint: normalized,
    }).toString();
    return {
      authorizationUrl: url.toString(),
      browserToken,
      secure: config.secure,
    };
  }

  private async googleJson(url: string, init?: RequestInit): Promise<unknown> {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        if (
          url === 'https://oauth2.googleapis.com/token' &&
          [400, 401].includes(response.status)
        )
          throw new UnauthorizedException(
            'El código Google es inválido o ya fue utilizado. Reinicie el acceso.',
          );
        throw new Error('Google rechazó la operación.');
      }
      return await response.json();
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException(
        'No se pudo verificar la identidad con Google. Reinicie el acceso.',
      );
    }
  }

  async exchange(
    code: string,
    state: string,
    browserToken: string,
  ): Promise<GoogleIdentity> {
    const config = this.config();
    const pending = this.pending.get(state);
    if (
      !pending ||
      pending.expiresAt <= Date.now() ||
      !browserToken ||
      pending.browserToken !== browserToken
    )
      throw new UnauthorizedException(
        'La autorización de Google caducó o no corresponde a este navegador.',
      );
    this.pending.delete(state); // También consume intentos fallidos; nunca reutilizar código/state.
    const token = (await this.googleJson(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: pending.verifier,
        }),
      },
    )) as { id_token?: unknown };
    try {
      if (typeof token.id_token !== 'string') throw new Error('No ID token');
      const decoded = jwt.decode(token.id_token, { complete: true });
      if (!decoded || decoded.header.alg !== 'RS256' || !decoded.header.kid)
        throw new Error('Invalid header');
      const keys = (await this.googleJson(
        'https://www.googleapis.com/oauth2/v3/certs',
      )) as { keys: GoogleKey[] };
      const jwk = keys.keys.find(
        (key) =>
          key.kid === decoded.header.kid &&
          key.kty === 'RSA' &&
          key.use === 'sig',
      );
      if (!jwk) throw new Error('Unknown key');
      const claims = jwt.verify(
        token.id_token,
        createPublicKey({ key: jwk, format: 'jwk' }),
        {
          algorithms: ['RS256'],
          audience: config.clientId,
          issuer: ['https://accounts.google.com', 'accounts.google.com'],
        },
      );
      if (
        typeof claims !== 'object' ||
        typeof claims.sub !== 'string' ||
        !claims.sub ||
        typeof claims.exp !== 'number' ||
        typeof claims.iat !== 'number' ||
        claims.iat > Date.now() / 1000 + 60 ||
        claims.nonce !== pending.nonce ||
        claims.email_verified !== true ||
        claims.hd !== 'unsa.edu.pe' ||
        typeof claims.email !== 'string' ||
        (claims.azp !== undefined && claims.azp !== config.clientId)
      )
        throw new Error('Invalid claims');
      return {
        subject: claims.sub,
        email: InstitutionalEmailPolicy.assertValid(claims.email),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new UnauthorizedException(
        'Google no confirmó una identidad institucional válida.',
      );
    }
  }
}
