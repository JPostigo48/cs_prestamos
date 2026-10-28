import type { CanActivate, Type } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../../modules/auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../modules/auth/presentation/guards/roles.guard.js';
import { ROLES_KEY } from '../../../modules/auth/presentation/decorators/roles.decorator.js';
import type { AccessRole } from '../../../modules/auth/domain/entities/access-account.js';
import type { OperationObject } from '@nestjs/swagger';

type Guard = Type<CanActivate> | CanActivate;

export interface AuthenticationMetadata {
  required: boolean;
  scope: 'public' | 'authenticated' | 'roles' | 'custom-guards';
  description: string;
  guards: string[];
}

export interface DocumentedOperation extends OperationObject {
  'x-roles'?: AccessRole[];
  'x-authentication'?: AuthenticationMetadata;
  'x-implementation-status'?: 'implemented' | 'pending';
}

/** Nest concatena guards, pero RolesGuard usa getAllAndOverride, no una unión. */
export function deriveAuthorization(
  controller: Type<unknown>,
  handler: Function,
  globalGuards: Guard[] = [],
) {
  const reflector = new Reflector();
  const guards: Guard[] = [
    ...globalGuards,
    ...(reflector.get<Guard[]>(GUARDS_METADATA, controller) ?? []),
    ...(reflector.get<Guard[]>(GUARDS_METADATA, handler) ?? []),
  ];
  const classes = guards.map((guard) =>
    typeof guard === 'function' ? guard : guard.constructor,
  );
  const required = classes.includes(AuthGuard);
  const roles = classes.includes(RolesGuard)
    ? (reflector.getAllAndOverride<AccessRole[]>(ROLES_KEY, [
        handler,
        controller,
      ]) ?? [])
    : [];
  const custom = classes.some(
    (guard) => guard !== AuthGuard && guard !== RolesGuard,
  );
  const scope = roles.length
    ? 'roles'
    : custom
      ? 'custom-guards'
      : required
        ? 'authenticated'
        : 'public';
  const authentication: AuthenticationMetadata = {
    required,
    scope,
    description: roles.length
      ? 'Roles efectivos exigidos por RolesGuard; pueden existir restricciones adicionales de propiedad o negocio.'
      : required
        ? 'Cualquier usuario autenticado; pueden existir restricciones adicionales de propiedad o negocio.'
        : custom
          ? 'Acceso condicionado por guards personalizados; no se infiere autenticación bearer.'
          : 'Público: no hay AuthGuard ni restricciones efectivas de RolesGuard.',
    guards: classes.map((guard) => guard.name),
  };
  return {
    'x-roles': roles,
    'x-authentication': authentication,
    security: required ? [{ bearer: [] }] : [],
  };
}
