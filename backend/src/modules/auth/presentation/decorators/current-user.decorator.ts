import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedIdentity } from '../../application/ports/auth.inputs.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedIdentity => {
    return context.switchToHttp().getRequest<Request & { user: AuthenticatedIdentity }>().user;
  },
);
