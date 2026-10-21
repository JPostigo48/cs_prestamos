import { Body, Controller, ForbiddenException, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiExtension, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUserLoanEligibilityUseCase } from '../../application/use-cases/get-user-loan-eligibility.use-case.js';
import { GetUserTrustProfileUseCase } from '../../application/use-cases/get-user-trust-profile.use-case.js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { ListUserSanctionsUseCase } from '../../application/use-cases/list-user-sanctions.use-case.js';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case.js';
import { UpdateAffiliationStatusUseCase } from '../../application/use-cases/update-affiliation-status.use-case.js';
import { UpdateAffiliationStatusDto } from '../dto/update-affiliation-status.dto.js';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';
import type { AuthenticatedIdentity } from '../../../auth/application/ports/auth.inputs.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard.js';

function assertSelfOrStaff(identity: AuthenticatedIdentity, userId: string): void {
  if (
    identity.userId !== userId &&
    identity.role !== AccessRole.OPERATOR &&
    identity.role !== AccessRole.ADMINISTRATOR
  ) {
    throw new ForbiddenException('No tiene permisos para consultar este usuario.');
  }
}

@ApiTags('Usuarios')
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
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
  @ApiExtension('x-implementation-status', 'implemented')
  getById(@Param('userId') userId: string, @CurrentUser() identity: AuthenticatedIdentity) {
    assertSelfOrStaff(identity, userId);
    return this.getUser.execute({ userId });
  }

  @Get(':userId/loan-eligibility')
  @ApiOperation({ summary: 'Consultar habilitación para préstamos' })
  @ApiExtension('x-implementation-status', 'implemented')
  getEligibility(@Param('userId') userId: string, @CurrentUser() identity: AuthenticatedIdentity) {
    assertSelfOrStaff(identity, userId);
    return this.getLoanEligibility.execute({ userId });
  }

  @Patch(':userId/affiliation-status')
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiExtension('x-implementation-status', 'implemented')
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
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiExtension('x-implementation-status', 'implemented')
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
  @ApiExtension('x-implementation-status', 'implemented')
  getTrust(@Param('userId') userId: string, @CurrentUser() identity: AuthenticatedIdentity) {
    assertSelfOrStaff(identity, userId);
    return this.getTrustProfile.execute({ userId });
  }

  @Get(':userId/trust-profile')
  @ApiExtension('x-implementation-status', 'implemented')
  getTrustProfileByName(@Param('userId') userId: string, @CurrentUser() identity: AuthenticatedIdentity) {
    assertSelfOrStaff(identity, userId);
    return this.getTrustProfile.execute({ userId });
  }

  @Get(':userId/sanctions')
  @ApiOperation({ summary: 'Consultar sanciones de un usuario' })
  @ApiExtension('x-implementation-status', 'implemented')
  getSanctions(@Param('userId') userId: string, @CurrentUser() identity: AuthenticatedIdentity) {
    assertSelfOrStaff(identity, userId);
    return this.listSanctions.execute({ userId });
  }
}
