import { Module } from '@nestjs/common';
import { JwtPort } from './application/ports/jwt.port.js';
import { JwtTokenAdapter } from './infrastructure/security/jwt-token.adapter.js';
import { AuthGuard } from './presentation/guards/auth.guard.js';
import { RolesGuard } from './presentation/guards/roles.guard.js';
import { AccessAccountRepository } from './domain/repositories/access-account.repository.js';
import { PrismaAccessAccountRepository } from './infrastructure/persistence/prisma/prisma-access-account.repository.js';

@Module({
  providers: [
    {
      provide: AccessAccountRepository,
      useClass: PrismaAccessAccountRepository,
    },
    { provide: JwtPort, useClass: JwtTokenAdapter },
    AuthGuard,
    RolesGuard,
  ],
  exports: [JwtPort, AuthGuard, RolesGuard, AccessAccountRepository],
})
export class SecurityModule {}
