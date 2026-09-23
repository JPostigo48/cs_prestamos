import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApproveRegistrationRequestUseCase } from '../../application/use-cases/approve-registration-request.use-case.js';
import { GetRegistrationRequestUseCase } from '../../application/use-cases/get-registration-request.use-case.js';
import { RejectRegistrationRequestUseCase } from '../../application/use-cases/reject-registration-request.use-case.js';
import { SubmitRegistrationRequestUseCase } from '../../application/use-cases/submit-registration-request.use-case.js';
import { SubmitRegistrationRequestDto } from '../dto/submit-registration-request.dto.js';

@Controller('users/registration-requests')
export class RegistrationRequestsController {
  constructor(
    private readonly submitRequest: SubmitRegistrationRequestUseCase,
    private readonly getRequest: GetRegistrationRequestUseCase,
    private readonly approveRequest: ApproveRegistrationRequestUseCase,
    private readonly rejectRequest: RejectRegistrationRequestUseCase,
  ) {}

  @Post()
  submit(@Body() dto: SubmitRegistrationRequestDto) {
    return this.submitRequest.execute(dto);
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
  reject(@Param('requestId') requestId: string) {
    return this.rejectRequest.execute({ requestId });
  }
}
