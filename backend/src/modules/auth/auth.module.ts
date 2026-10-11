import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthUserPort } from './application/ports/auth-user.port.js';
import { CredentialsPort } from './application/ports/credentials.port.js';
import { AuthenticateAccountUseCase } from './application/use-cases/authenticate-account.use-case.js';
import { GetAccessAccountUseCase } from './application/use-cases/get-access-account.use-case.js';
import { RegisterAccessAccountUseCase } from './application/use-cases/register-access-account.use-case.js';
import { UpdateAccessAccountUseCase } from './application/use-cases/update-access-account.use-case.js';
import { AccessAccountRepository } from './domain/repositories/access-account.repository.js';
import { UsersAuthAdapter } from './infrastructure/integration/users-auth.adapter.js';
import { PrismaAccessAccountRepository } from './infrastructure/persistence/prisma/prisma-access-account.repository.js';
import { PendingCredentialsAdapter } from './infrastructure/security/pending-credentials.adapter.js';
import { JwtPort } from './application/ports/jwt.port.js';
import { JwtTokenAdapter } from './infrastructure/security/jwt-token.adapter.js';
import { AuthGuard } from './presentation/guards/auth.guard.js';
import { RolesGuard } from './presentation/guards/roles.guard.js';
import { AuthController } from './presentation/controllers/auth.controller.js';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    RegisterAccessAccountUseCase,
    AuthenticateAccountUseCase,
    GetAccessAccountUseCase,
    UpdateAccessAccountUseCase,
    {
      provide: AccessAccountRepository,
      useClass: PrismaAccessAccountRepository,
    },
    {
      provide: AuthUserPort,
      useClass: UsersAuthAdapter,
    },
    {
      provide: CredentialsPort,
      useClass: PendingCredentialsAdapter,
    },
    {
      provide: JwtPort,
      useClass: JwtTokenAdapter,
    },
    AuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthenticateAccountUseCase,
    GetAccessAccountUseCase,
    UpdateAccessAccountUseCase,
    AuthGuard,
    RolesGuard,
    JwtPort,
  ],
})
export class AuthModule {}
