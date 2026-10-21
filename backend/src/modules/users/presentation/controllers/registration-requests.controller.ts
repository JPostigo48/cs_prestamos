import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiTags } from '@nestjs/swagger';
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

  @Post()
  @ApiBody({ type: SubmitRegistrationRequestDto })
  @ApiOperation({ summary: 'Presentar solicitud de registro' })
  submit(@Body() dto: SubmitRegistrationRequestDto) {
    return this.submitRequest.execute({
      name: dto.name ?? dto.nombre ?? '',
      userType: dto.userType ?? dto.tipoUsuario!,
      institutionalId: dto.institutionalId ?? dto.identificadorInstitucional,
      evidence: dto.evidence ?? dto.evidencias,
    });
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  list(@Query() query: { status?: string; institutionalId?: string; page?: number; limit?: number }) {
    return this.listRequests.execute(query);
  }

  @Get(':requestId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Consultar solicitud de registro' })
  getById(@Param('requestId') requestId: string) {
    return this.getRequest.execute({ requestId });
  }

  @Post(':requestId/approve')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Aprobar solicitud de registro' })
  approve(@Param('requestId') requestId: string) {
    return this.approveRequest.execute({ requestId });
  }

  @Post(':requestId/reject')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Rechazar solicitud de registro' })
  reject(@Param('requestId') requestId: string, @Body() body: RejectRegistrationRequestDto) {
    return this.rejectRequest.execute({ requestId, rejectionReason: body.rejectionReason });
  }
}
