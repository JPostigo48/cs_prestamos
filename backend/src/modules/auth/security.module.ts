import { Module } from '@nestjs/common';
import { JwtPort } from './application/ports/jwt.port.js';
import { JwtTokenAdapter } from './infrastructure/security/jwt-token.adapter.js';
import { AuthGuard } from './presentation/guards/auth.guard.js';
import { RolesGuard } from './presentation/guards/roles.guard.js';

@Module({
  providers: [
    { provide: JwtPort, useClass: JwtTokenAdapter },
    AuthGuard,
    RolesGuard,
  ],
  exports: [JwtPort, AuthGuard, RolesGuard],
})
export class SecurityModule {}
