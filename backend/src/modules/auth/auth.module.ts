import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthUserPort } from './application/ports/auth-user.port.js';
import { CredentialsPort } from './application/ports/credentials.port.js';
import { AuthenticateAccountUseCase } from './application/use-cases/authenticate-account.use-case.js';
import { GetAccessAccountUseCase } from './application/use-cases/get-access-account.use-case.js';
import { RegisterAccessAccountUseCase } from './application/use-cases/register-access-account.use-case.js';
import { UpdateAccessAccountUseCase } from './application/use-cases/update-access-account.use-case.js';
import { UsersAuthAdapter } from './infrastructure/integration/users-auth.adapter.js';
import { PendingCredentialsAdapter } from './infrastructure/security/pending-credentials.adapter.js';
import { AuthController } from './presentation/controllers/auth.controller.js';
import { SecurityModule } from './security.module.js';
import { FullRegistrationUseCase } from './application/use-cases/full-registration.use-case.js';
import { RegistrationPort } from './application/ports/registration.port.js';
import { UsersRegistrationAdapter } from './infrastructure/integration/users-registration.adapter.js';
import { GoogleIdentityPort } from './application/ports/google-identity.port.js';
import { GoogleIdentityAdapter } from './infrastructure/security/google-identity.adapter.js';
import { GoogleAuthenticationUseCase } from './application/use-cases/google-authentication.use-case.js';

@Module({
  imports: [UsersModule, SecurityModule],
  controllers: [AuthController],
  providers: [
    FullRegistrationUseCase,
    GoogleAuthenticationUseCase,
    { provide: RegistrationPort, useClass: UsersRegistrationAdapter },
    { provide: GoogleIdentityPort, useClass: GoogleIdentityAdapter },
    RegisterAccessAccountUseCase,
    AuthenticateAccountUseCase,
    GetAccessAccountUseCase,
    UpdateAccessAccountUseCase,
    {
      provide: AuthUserPort,
      useClass: UsersAuthAdapter,
    },
    {
      provide: CredentialsPort,
      useClass: PendingCredentialsAdapter,
    },
  ],
  exports: [
    AuthenticateAccountUseCase,
    GetAccessAccountUseCase,
    UpdateAccessAccountUseCase,
    SecurityModule,
  ],
})
export class AuthModule {}
