import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedIdentity } from '../../application/ports/auth.inputs.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AccessRole } from '../../domain/entities/access-account.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AccessRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedIdentity }
    >().user;
    if (user && roles.includes(user.role)) return true;
    throw new ForbiddenException('No tiene permisos para esta operación.');
  }
}
