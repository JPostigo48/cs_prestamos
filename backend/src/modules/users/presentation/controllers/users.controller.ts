import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUserLoanEligibilityUseCase } from '../../application/use-cases/get-user-loan-eligibility.use-case.js';
import { GetUserTrustProfileUseCase } from '../../application/use-cases/get-user-trust-profile.use-case.js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { ListUserSanctionsUseCase } from '../../application/use-cases/list-user-sanctions.use-case.js';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case.js';
import { UpdateAffiliationStatusUseCase } from '../../application/use-cases/update-affiliation-status.use-case.js';
import { UpdateAffiliationStatusDto } from '../dto/update-affiliation-status.dto.js';

@ApiTags('Usuarios')
@Controller('users')
export class UsersController {
  constructor(
    private readonly getUser: GetUserUseCase,
    private readonly getLoanEligibility: GetUserLoanEligibilityUseCase,
    private readonly getTrustProfile: GetUserTrustProfileUseCase,
    private readonly listSanctions: ListUserSanctionsUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly updateAffiliation: UpdateAffiliationStatusUseCase,
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

  @Patch(':userId/affiliation-status')
  updateAffiliationStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateAffiliationStatusDto,
  ) {
    return this.updateAffiliation.execute({
      userId,
      hasCurrentAffiliation: dto.vinculacionVigente,
    });
  }

  @Get()
  list(@Query() query: { userType?: string; vinculacionVigente?: string; institutionalId?: string; page?: number; limit?: number }) {
    return this.listUsers.execute({
      userType: query.userType,
      institutionalId: query.institutionalId,
      hasCurrentAffiliation: query.vinculacionVigente === undefined ? undefined : query.vinculacionVigente === 'true',
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':userId/trust')
  @ApiOperation({ summary: 'Consultar perfil de confianza' })
  getTrust(@Param('userId') userId: string) {
    return this.getTrustProfile.execute({ userId });
  }

  @Get(':userId/trust-profile')
  getTrustProfileByName(@Param('userId') userId: string) {
    return this.getTrustProfile.execute({ userId });
  }

  @Get(':userId/sanctions')
  @ApiOperation({ summary: 'Consultar sanciones de un usuario' })
  getSanctions(@Param('userId') userId: string) {
    return this.listSanctions.execute({ userId });
  }
}
