import { SetMetadata } from '@nestjs/common';
import type { AccessRole } from '../../domain/entities/access-account.js';

export const ROLES_KEY = 'auth:roles';
export const Roles = (...roles: AccessRole[]) => SetMetadata(ROLES_KEY, roles);
