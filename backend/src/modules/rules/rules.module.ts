import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { UserTrustPort } from './application/ports/user-trust.port.js';
import { AcceptTermsVersionUseCase } from './application/use-cases/accept-terms-version.use-case.js';
import { CreateRuleUseCase } from './application/use-cases/create-rule.use-case.js';
import { CreateTermsVersionUseCase } from './application/use-cases/create-terms-version.use-case.js';
import { ListActiveRulesUseCase } from './application/use-cases/list-active-rules.use-case.js';
import { ListUserTermsAcceptancesUseCase } from './application/use-cases/list-user-terms-acceptances.use-case.js';
import { RegisterViolationUseCase } from './application/use-cases/register-violation.use-case.js';
import { ResolveAppealUseCase } from './application/use-cases/resolve-appeal.use-case.js';
import { SetRuleStatusUseCase } from './application/use-cases/set-rule-status.use-case.js';
import { SubmitAppealUseCase } from './application/use-cases/submit-appeal.use-case.js';
import { UpdateRuleUseCase } from './application/use-cases/update-rule.use-case.js';
import { AppealRepository } from './domain/repositories/appeal.repository.js';
import { RuleRepository } from './domain/repositories/rule.repository.js';
import { TermsRepository } from './domain/repositories/terms.repository.js';
import { ViolationRepository } from './domain/repositories/violation.repository.js';
import { UsersTrustAdapter } from './infrastructure/integration/users-trust.adapter.js';
import { PrismaAppealRepository } from './infrastructure/persistence/prisma/prisma-appeal.repository.js';
import { PrismaRuleRepository } from './infrastructure/persistence/prisma/prisma-rule.repository.js';
import { PrismaTermsRepository } from './infrastructure/persistence/prisma/prisma-terms.repository.js';
import { PrismaViolationRepository } from './infrastructure/persistence/prisma/prisma-violation.repository.js';
import { RulesController } from './presentation/controllers/rules.controller.js';
import { TermsController } from './presentation/controllers/terms.controller.js';
import { ViolationsController } from './presentation/controllers/violations.controller.js';

const useCases = [
  CreateRuleUseCase,
  UpdateRuleUseCase,
  SetRuleStatusUseCase,
  ListActiveRulesUseCase,
  RegisterViolationUseCase,
  SubmitAppealUseCase,
  ResolveAppealUseCase,
  CreateTermsVersionUseCase,
  AcceptTermsVersionUseCase,
  ListUserTermsAcceptancesUseCase,
];

@Module({
  imports: [UsersModule],
  controllers: [RulesController, ViolationsController, TermsController],
  providers: [
    ...useCases,
    {
      provide: RuleRepository,
      useClass: PrismaRuleRepository,
    },
    {
      provide: ViolationRepository,
      useClass: PrismaViolationRepository,
    },
    {
      provide: AppealRepository,
      useClass: PrismaAppealRepository,
    },
    {
      provide: TermsRepository,
      useClass: PrismaTermsRepository,
    },
    {
      provide: UserTrustPort,
      useClass: UsersTrustAdapter,
    },
  ],
})
export class RulesModule {}
