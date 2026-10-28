import { ApiHttpErrors } from '../../../../shared/presentation/openapi/api-http-errors.decorator.js';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtension,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserType } from '../../domain/entities/registration-request.js';
import {
  LoanEligibilityResponseDto,
  TrustProfileResponseDto,
  SanctionResponseDto,
} from '../dto/users-response.dto.js';
import { ManageUsersUseCase } from '../../application/use-cases/manage-users.use-case.js';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UsersPageResponseDto,
} from '../dto/manage-user.dto.js';
import { GetUserLoanEligibilityUseCase } from '../../application/use-cases/get-user-loan-eligibility.use-case.js';
import { GetUserTrustProfileUseCase } from '../../application/use-cases/get-user-trust-profile.use-case.js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { ListUserSanctionsUseCase } from '../../application/use-cases/list-user-sanctions.use-case.js';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case.js';
import { UpdateAffiliationStatusDto } from '../dto/update-affiliation-status.dto.js';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';
import type { AuthenticatedIdentity } from '../../../auth/application/ports/auth.inputs.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard.js';

function assertSelfOrStaff(
  identity: AuthenticatedIdentity,
  userId: string,
): void {
  if (
    identity.userId !== userId &&
    identity.role !== AccessRole.OPERATOR &&
    identity.role !== AccessRole.ADMINISTRATOR
  ) {
    throw new ForbiddenException(
      'No tiene permisos para consultar este usuario.',
    );
  }
}

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly getUser: GetUserUseCase,
    private readonly getLoanEligibility: GetUserLoanEligibilityUseCase,
    private readonly getTrustProfile: GetUserTrustProfileUseCase,
    private readonly listSanctions: ListUserSanctionsUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly manageUsers: ManageUsersUseCase,
  ) {}

  @ApiHttpErrors(400, 409)
  @Post()
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiOperation({
    summary: 'Crear usuario de dominio, sin crear cuenta de acceso',
  })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.manageUsers.create(dto, actor);
  }

  @ApiHttpErrors(400, 404, 409)
  @Patch(':userId')
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: UserResponseDto })
  update(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.manageUsers.update(userId, dto, actor);
  }

  @ApiHttpErrors(400, 404, 409)
  @Delete(':userId')
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiOkResponse({ type: UserResponseDto })
  @ApiOperation({
    summary:
      'Dar de baja la vinculación sin borrar cuenta ni historial; rechaza operaciones abiertas',
  })
  deactivate(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.manageUsers.deactivate(userId, actor);
  }

  @ApiHttpErrors(403, 404)
  @Get(':userId')
  @ApiOkResponse({
    type: UserResponseDto,
    description: 'Usuario propio o consultado por personal operativo.',
  })
  @ApiOperation({ summary: 'Consultar usuario' })
  @ApiExtension('x-implementation-status', 'implemented')
  getById(
    @Param('userId') userId: string,
    @CurrentUser() identity: AuthenticatedIdentity,
  ) {
    assertSelfOrStaff(identity, userId);
    return this.getUser.execute({ userId });
  }

  @ApiHttpErrors(403, 404)
  @Get(':userId/loan-eligibility')
  @ApiOkResponse({
    type: LoanEligibilityResponseDto,
    description: 'Habilitación propia o consultada por personal operativo.',
  })
  @ApiOperation({ summary: 'Consultar habilitación para préstamos' })
  @ApiExtension('x-implementation-status', 'implemented')
  getEligibility(
    @Param('userId') userId: string,
    @CurrentUser() identity: AuthenticatedIdentity,
  ) {
    assertSelfOrStaff(identity, userId);
    return this.getLoanEligibility.execute({ userId });
  }

  @ApiHttpErrors(400, 404, 409)
  @Patch(':userId/affiliation-status')
  @ApiBody({ type: UpdateAffiliationStatusDto })
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiOkResponse({ type: UserResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  updateAffiliationStatus(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateAffiliationStatusDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.manageUsers.update(
      userId,
      {
        hasCurrentAffiliation: dto.vinculacionVigente,
      },
      actor,
    );
  }

  @Get()
  @ApiQuery({ name: 'userType', required: false, enum: UserType })
  @ApiQuery({
    name: 'vinculacionVigente',
    required: false,
    type: String,
    description: 'Solo el texto true se interpreta como verdadero.',
  })
  @ApiQuery({ name: 'institutionalId', required: false, type: String })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Por defecto 1; normalizado a un mínimo de 1.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Por defecto 20; normalizado entre 1 y 100.',
  })
  @ApiOkResponse({ type: UsersPageResponseDto })
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiExtension('x-implementation-status', 'implemented')
  list(
    @Query()
    query: {
      userType?: string;
      vinculacionVigente?: string;
      institutionalId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.listUsers.execute({
      userType: query.userType,
      institutionalId: query.institutionalId,
      hasCurrentAffiliation:
        query.vinculacionVigente === undefined
          ? undefined
          : query.vinculacionVigente === 'true',
      page: query.page,
      limit: query.limit,
    });
  }

  @ApiHttpErrors(403, 404)
  @Get(':userId/trust')
  @ApiOkResponse({
    type: TrustProfileResponseDto,
    description: 'Perfil propio o consultado por personal operativo.',
  })
  @ApiOperation({ summary: 'Consultar perfil de confianza' })
  @ApiExtension('x-implementation-status', 'implemented')
  getTrust(
    @Param('userId') userId: string,
    @CurrentUser() identity: AuthenticatedIdentity,
  ) {
    assertSelfOrStaff(identity, userId);
    return this.getTrustProfile.execute({ userId });
  }

  @ApiHttpErrors(403, 404)
  @Get(':userId/trust-profile')
  @ApiOkResponse({
    type: TrustProfileResponseDto,
    description:
      'Alias de trust; perfil propio o consultado por personal operativo.',
  })
  @ApiExtension('x-implementation-status', 'implemented')
  getTrustProfileByName(
    @Param('userId') userId: string,
    @CurrentUser() identity: AuthenticatedIdentity,
  ) {
    assertSelfOrStaff(identity, userId);
    return this.getTrustProfile.execute({ userId });
  }

  @ApiHttpErrors(403)
  @Get(':userId/sanctions')
  @ApiOkResponse({
    type: [SanctionResponseDto],
    description: 'Sanciones propias o consultadas por personal operativo.',
  })
  @ApiOperation({ summary: 'Consultar sanciones de un usuario' })
  @ApiExtension('x-implementation-status', 'implemented')
  getSanctions(
    @Param('userId') userId: string,
    @CurrentUser() identity: AuthenticatedIdentity,
  ) {
    assertSelfOrStaff(identity, userId);
    return this.listSanctions.execute({ userId });
  }
}
