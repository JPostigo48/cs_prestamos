import type { AuthenticatedIdentity } from './auth.inputs.js';

export abstract class JwtPort {
  abstract sign(identity: AuthenticatedIdentity): string;
  abstract verify(token: string): AuthenticatedIdentity;
}
