import { ApiHttpErrors } from '../../../../shared/presentation/openapi/api-http-errors.decorator.js';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExtension,
  ApiOperation,
  ApiBody,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { RegistrationRequestStatus } from '../../domain/entities/registration-request.js';
import {
  RegistrationRequestResponseDto,
  RegistrationRequestsPageResponseDto,
  ApprovedRegistrationResponseDto,
} from '../dto/users-response.dto.js';
import { ApproveRegistrationRequestUseCase } from '../../application/use-cases/approve-registration-request.use-case.js';
import { GetRegistrationRequestUseCase } from '../../application/use-cases/get-registration-request.use-case.js';
import { RejectRegistrationRequestUseCase } from '../../application/use-cases/reject-registration-request.use-case.js';
import { SubmitRegistrationRequestUseCase } from '../../application/use-cases/submit-registration-request.use-case.js';
import { SubmitRegistrationRequestDto } from '../dto/submit-registration-request.dto.js';
import { ListRegistrationRequestsUseCase } from '../../application/use-cases/list-registration-requests.use-case.js';
import { RejectRegistrationRequestDto } from '../dto/reject-registration-request.dto.js';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard.js';

@ApiTags('Usuarios')
@Controller('users/registration-requests')
export class RegistrationRequestsController {
  constructor(
    private readonly submitRequest: SubmitRegistrationRequestUseCase,
    private readonly getRequest: GetRegistrationRequestUseCase,
    private readonly approveRequest: ApproveRegistrationRequestUseCase,
    private readonly rejectRequest: RejectRegistrationRequestUseCase,
    private readonly listRequests: ListRegistrationRequestsUseCase,
  ) {}

  @ApiHttpErrors(400, 409)
  @Post()
  @ApiCreatedResponse({ type: RegistrationRequestResponseDto })
  @ApiBody({ type: SubmitRegistrationRequestDto })
  @ApiOperation({ summary: 'Presentar solicitud de registro' })
  @ApiExtension('x-implementation-status', 'implemented')
  submit(@Body() dto: SubmitRegistrationRequestDto) {
    return this.submitRequest.execute({
      name: dto.name ?? dto.nombre ?? '',
      userType: dto.userType ?? dto.tipoUsuario!,
      institutionalId: dto.institutionalId ?? dto.identificadorInstitucional,
      evidence: dto.evidence ?? dto.evidencias,
    });
  }

  @Get()
  @ApiOkResponse({ type: RegistrationRequestsPageResponseDto })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RegistrationRequestStatus,
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
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiExtension('x-implementation-status', 'implemented')
  list(
    @Query()
    query: {
      status?: string;
      institutionalId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.listRequests.execute(query);
  }

  @ApiHttpErrors(404)
  @Get(':requestId')
  @ApiOkResponse({ type: RegistrationRequestResponseDto })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Consultar solicitud de registro' })
  @ApiExtension('x-implementation-status', 'implemented')
  getById(@Param('requestId') requestId: string) {
    return this.getRequest.execute({ requestId });
  }

  @ApiHttpErrors(404, 409)
  @Post(':requestId/approve')
  @ApiCreatedResponse({ type: ApprovedRegistrationResponseDto })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Aprobar solicitud de registro' })
  @ApiExtension('x-implementation-status', 'implemented')
  approve(@Param('requestId') requestId: string) {
    return this.approveRequest.execute({ requestId });
  }

  @ApiHttpErrors(400, 404, 409)
  @Post(':requestId/reject')
  @ApiBody({ type: RejectRegistrationRequestDto })
  @ApiCreatedResponse({ type: RegistrationRequestResponseDto })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Rechazar solicitud de registro' })
  @ApiExtension('x-implementation-status', 'implemented')
  reject(
    @Param('requestId') requestId: string,
    @Body() body: RejectRegistrationRequestDto,
  ) {
    return this.rejectRequest.execute({
      requestId,
      rejectionReason: body.rejectionReason,
    });
  }
}
