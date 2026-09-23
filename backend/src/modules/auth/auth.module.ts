import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthUserPort } from './application/ports/auth-user.port.js';
import { CredentialsPort } from './application/ports/credentials.port.js';
import { AuthenticateAccountUseCase } from './application/use-cases/authenticate-account.use-case.js';
import { GetAccessAccountUseCase } from './application/use-cases/get-access-account.use-case.js';
import { RegisterAccessAccountUseCase } from './application/use-cases/register-access-account.use-case.js';
import { AccessAccountRepository } from './domain/repositories/access-account.repository.js';
import { UsersAuthAdapter } from './infrastructure/integration/users-auth.adapter.js';
import { PrismaAccessAccountRepository } from './infrastructure/persistence/prisma/prisma-access-account.repository.js';
import { PendingCredentialsAdapter } from './infrastructure/security/pending-credentials.adapter.js';
import { AuthController } from './presentation/controllers/auth.controller.js';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    RegisterAccessAccountUseCase,
    AuthenticateAccountUseCase,
    GetAccessAccountUseCase,
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
  ],
  exports: [AuthenticateAccountUseCase, GetAccessAccountUseCase],
})
export class AuthModule {}
