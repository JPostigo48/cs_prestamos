import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUserLoanEligibilityUseCase } from '../../application/use-cases/get-user-loan-eligibility.use-case.js';
import { GetUserTrustProfileUseCase } from '../../application/use-cases/get-user-trust-profile.use-case.js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { ListUserSanctionsUseCase } from '../../application/use-cases/list-user-sanctions.use-case.js';

@ApiTags('Usuarios')
@Controller('users')
export class UsersController {
  constructor(
    private readonly getUser: GetUserUseCase,
    private readonly getLoanEligibility: GetUserLoanEligibilityUseCase,
    private readonly getTrustProfile: GetUserTrustProfileUseCase,
    private readonly listSanctions: ListUserSanctionsUseCase,
  ) {}

  @Get(':userId')
  @ApiOperation({ summary: 'Consultar usuario' })
  getById(@Param('userId') userId: string) {
    return this.getUser.execute({ userId });
  }

  @Get(':userId/loan-eligibility')
  @ApiOperation({ summary: 'Consultar habilitación para préstamos' })
  getEligibility(@Param('userId') userId: string) {
    return this.getLoanEligibility.execute({ userId });
  }

  @Get(':userId/trust')
  @ApiOperation({ summary: 'Consultar perfil de confianza' })
  getTrust(@Param('userId') userId: string) {
    return this.getTrustProfile.execute({ userId });
  }

  @Get(':userId/sanctions')
  @ApiOperation({ summary: 'Consultar sanciones de un usuario' })
  getSanctions(@Param('userId') userId: string) {
    return this.listSanctions.execute({ userId });
  }
}
