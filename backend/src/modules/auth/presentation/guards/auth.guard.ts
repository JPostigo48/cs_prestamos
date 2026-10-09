import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedIdentity } from '../../application/ports/auth.inputs.js';
import { JwtPort } from '../../application/ports/jwt.port.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtPort) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedIdentity }
    >();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acceso requerido.');
    }
    if (!authorization.slice(7).trim()) {
      throw new UnauthorizedException('Token de acceso requerido.');
    }
    request.user = this.jwt.verify(authorization.slice(7).trim());
    return true;
  }
}
