import { Controller, Get, Param } from '@nestjs/common';
import { GetUserLoanEligibilityUseCase } from '../../application/use-cases/get-user-loan-eligibility.use-case.js';
import { GetUserTrustProfileUseCase } from '../../application/use-cases/get-user-trust-profile.use-case.js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { ListUserSanctionsUseCase } from '../../application/use-cases/list-user-sanctions.use-case.js';

@Controller('users')
export class UsersController {
  constructor(
    private readonly getUser: GetUserUseCase,
    private readonly getLoanEligibility: GetUserLoanEligibilityUseCase,
    private readonly getTrustProfile: GetUserTrustProfileUseCase,
    private readonly listSanctions: ListUserSanctionsUseCase,
  ) {}

  @Get(':userId')
  getById(@Param('userId') userId: string) {
    return this.getUser.execute({ userId });
  }

  @Get(':userId/loan-eligibility')
  getEligibility(@Param('userId') userId: string) {
    return this.getLoanEligibility.execute({ userId });
  }

  @Get(':userId/trust')
  getTrust(@Param('userId') userId: string) {
    return this.getTrustProfile.execute({ userId });
  }

  @Get(':userId/sanctions')
  getSanctions(@Param('userId') userId: string) {
    return this.listSanctions.execute({ userId });
  }
}
