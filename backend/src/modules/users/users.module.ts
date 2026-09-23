import { Module } from '@nestjs/common';
import { ApplyTrustPenaltyUseCase } from './application/use-cases/apply-trust-penalty.use-case.js';
import { ApproveRegistrationRequestUseCase } from './application/use-cases/approve-registration-request.use-case.js';
import { GetRegistrationRequestUseCase } from './application/use-cases/get-registration-request.use-case.js';
import { GetUserLoanEligibilityUseCase } from './application/use-cases/get-user-loan-eligibility.use-case.js';
import { GetUserTrustProfileUseCase } from './application/use-cases/get-user-trust-profile.use-case.js';
import { GetUserUseCase } from './application/use-cases/get-user.use-case.js';
import { ListUserSanctionsUseCase } from './application/use-cases/list-user-sanctions.use-case.js';
import { RejectRegistrationRequestUseCase } from './application/use-cases/reject-registration-request.use-case.js';
import { SubmitRegistrationRequestUseCase } from './application/use-cases/submit-registration-request.use-case.js';
import { RegistrationRequestRepository } from './domain/repositories/registration-request.repository.js';
import { UserRepository } from './domain/repositories/user.repository.js';
import { PrismaRegistrationRequestRepository } from './infrastructure/persistence/prisma/prisma-registration-request.repository.js';
import { PrismaUserRepository } from './infrastructure/persistence/prisma/prisma-user.repository.js';
import { RegistrationRequestsController } from './presentation/controllers/registration-requests.controller.js';
import { UsersController } from './presentation/controllers/users.controller.js';

const useCases = [
  SubmitRegistrationRequestUseCase,
  GetRegistrationRequestUseCase,
  ApproveRegistrationRequestUseCase,
  RejectRegistrationRequestUseCase,
  GetUserUseCase,
  GetUserLoanEligibilityUseCase,
  GetUserTrustProfileUseCase,
  ApplyTrustPenaltyUseCase,
  ListUserSanctionsUseCase,
];

@Module({
  controllers: [RegistrationRequestsController, UsersController],
  providers: [
    ...useCases,
    {
      provide: RegistrationRequestRepository,
      useClass: PrismaRegistrationRequestRepository,
    },
    {
      provide: UserRepository,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [
    GetUserUseCase,
    GetUserLoanEligibilityUseCase,
    ApplyTrustPenaltyUseCase,
  ],
})
export class UsersModule {}
