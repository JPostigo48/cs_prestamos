import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { RegisterViolationUseCase } from '../../application/use-cases/register-violation.use-case.js';
import { ResolveAppealUseCase } from '../../application/use-cases/resolve-appeal.use-case.js';
import { SubmitAppealUseCase } from '../../application/use-cases/submit-appeal.use-case.js';
import {
  RegisterViolationDto,
  ResolveAppealDto,
  SubmitAppealDto,
} from '../dto/violation.dto.js';

@Controller()
export class ViolationsController {
  constructor(
    private readonly registerViolation: RegisterViolationUseCase,
    private readonly submitAppeal: SubmitAppealUseCase,
    private readonly resolveAppeal: ResolveAppealUseCase,
  ) {}

  @Post('violations')
  register(@Body() input: RegisterViolationDto) {
    return this.registerViolation.execute(input);
  }

  @Post('violations/:violationId/appeals')
  appeal(
    @Param('violationId') violationId: string,
    @Body() input: SubmitAppealDto,
  ) {
    return this.submitAppeal.execute({
      violationId,
      userId: input.userId,
      reason: input.reason,
      submittedAt: input.submittedAt,
    });
  }

  @Patch('appeals/:appealId/resolution')
  resolve(
    @Param('appealId') appealId: string,
    @Body() input: ResolveAppealDto,
  ) {
    return this.resolveAppeal.execute({
      appealId,
      status: input.status,
      resolution: input.resolution,
      resolvedAt: input.resolvedAt,
      resolvedByAccountId: input.resolvedByAccountId,
    });
  }
}
