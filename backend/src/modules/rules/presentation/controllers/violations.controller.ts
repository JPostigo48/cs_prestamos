import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiExtension, ApiOperation, ApiBody, ApiTags } from '@nestjs/swagger';
import { RegisterViolationUseCase } from '../../application/use-cases/register-violation.use-case.js';
import { ResolveAppealUseCase } from '../../application/use-cases/resolve-appeal.use-case.js';
import { SubmitAppealUseCase } from '../../application/use-cases/submit-appeal.use-case.js';
import {
  RegisterViolationDto,
  ResolveAppealDto,
  SubmitAppealDto,
} from '../dto/violation.dto.js';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import type { AuthenticatedIdentity } from '../../../auth/application/ports/auth.inputs.js';

@ApiTags('Reglas y términos')
@Controller()
@UseGuards(AuthGuard)
export class ViolationsController {
  constructor(
    private readonly registerViolation: RegisterViolationUseCase,
    private readonly submitAppeal: SubmitAppealUseCase,
    private readonly resolveAppeal: ResolveAppealUseCase,
  ) {}

  @Post('violations')
  @UseGuards(RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiBody({ type: RegisterViolationDto })
  @ApiOperation({ summary: 'Registrar incumplimiento' })
  @ApiExtension('x-implementation-status', 'implemented')
  register(@Body() input: RegisterViolationDto) {
    return this.registerViolation.execute(input);
  }

  @Post('sanctions/:sanctionId/appeals')
  @ApiBody({ type: SubmitAppealDto })
  @ApiOperation({ summary: 'Presentar apelación de una sanción' })
  @ApiExtension('x-implementation-status', 'implemented')
  appeal(
    @Param('sanctionId') sanctionId: string,
    @Body() input: SubmitAppealDto,
    @CurrentUser() user: AuthenticatedIdentity,
  ) {
    return this.submitAppeal.execute({
      sanctionId,
      userId: user.userId,
      reason: input.reason,
    });
  }

  @Patch('appeals/:appealId/resolution')
  @UseGuards(RolesGuard)
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiBody({ type: ResolveAppealDto })
  @ApiOperation({ summary: 'Resolver apelación' })
  @ApiExtension('x-implementation-status', 'implemented')
  resolve(
    @Param('appealId') appealId: string,
    @Body() input: ResolveAppealDto,
    @CurrentUser() user: AuthenticatedIdentity,
  ) {
    return this.resolveAppeal.execute({
      appealId,
      status: input.status,
      resolution: input.resolution,
      resolvedAt: new Date(),
      resolvedByAccountId: user.accountId,
    });
  }
}
