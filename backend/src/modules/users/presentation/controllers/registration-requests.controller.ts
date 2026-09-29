import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApproveRegistrationRequestUseCase } from '../../application/use-cases/approve-registration-request.use-case.js';
import { GetRegistrationRequestUseCase } from '../../application/use-cases/get-registration-request.use-case.js';
import { RejectRegistrationRequestUseCase } from '../../application/use-cases/reject-registration-request.use-case.js';
import { SubmitRegistrationRequestUseCase } from '../../application/use-cases/submit-registration-request.use-case.js';
import { SubmitRegistrationRequestDto } from '../dto/submit-registration-request.dto.js';
import { ListRegistrationRequestsUseCase } from '../../application/use-cases/list-registration-requests.use-case.js';
import { RejectRegistrationRequestDto } from '../dto/reject-registration-request.dto.js';

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
  submit(@Body() dto: SubmitRegistrationRequestDto) {
    return this.submitRequest.execute({
      name: dto.name ?? dto.nombre ?? '',
      userType: dto.userType ?? dto.tipoUsuario!,
      institutionalId: dto.institutionalId ?? dto.identificadorInstitucional,
      evidence: dto.evidence ?? dto.evidencias,
    });
  }

  @Get()
  list(@Query() query: { status?: string; institutionalId?: string; page?: number; limit?: number }) {
    return this.listRequests.execute(query);
  }

  @Get(':requestId')
  getById(@Param('requestId') requestId: string) {
    return this.getRequest.execute({ requestId });
  }

  @Post(':requestId/approve')
  approve(@Param('requestId') requestId: string) {
    return this.approveRequest.execute({ requestId });
  }

  @Post(':requestId/reject')
  reject(@Param('requestId') requestId: string, @Body() body: RejectRegistrationRequestDto) {
    return this.rejectRequest.execute({ requestId, rejectionReason: body.rejectionReason });
  }
}
