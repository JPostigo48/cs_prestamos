import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedIdentity } from '../../application/ports/auth.inputs.js';
import { JwtPort } from '../../application/ports/jwt.port.js';
import { AccessAccountRepository } from '../../domain/repositories/access-account.repository.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtPort,
    private readonly accounts: AccessAccountRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedIdentity }>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acceso requerido.');
    }
    if (!authorization.slice(7).trim()) {
      throw new UnauthorizedException('Token de acceso requerido.');
    }
    const identity = this.jwt.verify(authorization.slice(7).trim());
    const account = await this.accounts.findById(identity.accountId);
    if (
      !account ||
      !account.enabled ||
      account.userId !== identity.userId ||
      account.role !== identity.role
    )
      throw new UnauthorizedException(
        'La cuenta o sus permisos cambiaron. Inicie sesión nuevamente.',
      );
    request.user = identity;
    return true;
  }
}
