import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type {
  AuthenticatedIdentity,
} from '../../application/ports/auth.inputs.js';
import { JwtPort } from '../../application/ports/jwt.port.js';

type JwtClaims = AuthenticatedIdentity & {
  iat?: number;
  exp?: number;
};

@Injectable()
export class JwtTokenAdapter implements JwtPort {
  private readonly secret = process.env.JWT_SECRET;
  private readonly expiresIn = process.env.JWT_EXPIRES_IN ?? '3600s';

  constructor() {
    if (!this.secret && process.env.NODE_ENV !== 'test') {
      throw new Error('JWT_SECRET es obligatorio para iniciar el backend.');
    }
    if (!/^\d+(s|m|h|d)?$/.test(this.expiresIn)) {
      throw new Error(
        'JWT_EXPIRES_IN debe ser un número seguido opcionalmente de s, m, h o d.',
      );
    }
  }

  sign(identity: AuthenticatedIdentity): string {
    return jwt.sign(identity, this.secret ?? 'test-secret', {
      expiresIn: this.expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  verify(token: string): AuthenticatedIdentity {
    try {
      const claims = jwt.verify(token, this.secret ?? 'test-secret') as JwtClaims;
      if (
        typeof claims !== 'object' ||
        typeof claims.accountId !== 'string' ||
        typeof claims.userId !== 'string' ||
        typeof claims.userType !== 'string' ||
        typeof claims.role !== 'string'
      ) {
        throw new Error('Invalid claims');
      }
      return {
        accountId: claims.accountId,
        userId: claims.userId,
        userType: claims.userType,
        role: claims.role,
      };
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }
}
