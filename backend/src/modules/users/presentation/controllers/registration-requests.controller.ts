import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiTags } from '@nestjs/swagger';
import { ApproveRegistrationRequestUseCase } from '../../application/use-cases/approve-registration-request.use-case.js';
import { GetRegistrationRequestUseCase } from '../../application/use-cases/get-registration-request.use-case.js';
import { RejectRegistrationRequestUseCase } from '../../application/use-cases/reject-registration-request.use-case.js';
import { SubmitRegistrationRequestUseCase } from '../../application/use-cases/submit-registration-request.use-case.js';
import { SubmitRegistrationRequestDto } from '../dto/submit-registration-request.dto.js';

@ApiTags('Usuarios')
@Controller('users/registration-requests')
export class RegistrationRequestsController {
  constructor(
    private readonly submitRequest: SubmitRegistrationRequestUseCase,
    private readonly getRequest: GetRegistrationRequestUseCase,
    private readonly approveRequest: ApproveRegistrationRequestUseCase,
    private readonly rejectRequest: RejectRegistrationRequestUseCase,
  ) {}

  @Post()
  @ApiBody({ type: SubmitRegistrationRequestDto })
  @ApiOperation({ summary: 'Presentar solicitud de registro' })
  submit(@Body() dto: SubmitRegistrationRequestDto) {
    return this.submitRequest.execute(dto);
  }

  @Get(':requestId')
  @ApiOperation({ summary: 'Consultar solicitud de registro' })
  getById(@Param('requestId') requestId: string) {
    return this.getRequest.execute({ requestId });
  }

  @Post(':requestId/approve')
  @ApiOperation({ summary: 'Aprobar solicitud de registro' })
  approve(@Param('requestId') requestId: string) {
    return this.approveRequest.execute({ requestId });
  }

  @Post(':requestId/reject')
  @ApiOperation({ summary: 'Rechazar solicitud de registro' })
  reject(@Param('requestId') requestId: string) {
    return this.rejectRequest.execute({ requestId });
  }
}
