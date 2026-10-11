import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiTags } from '@nestjs/swagger';
import { AcceptTermsVersionUseCase } from '../../application/use-cases/accept-terms-version.use-case.js';
import { CreateTermsVersionUseCase } from '../../application/use-cases/create-terms-version.use-case.js';
import { ListUserTermsAcceptancesUseCase } from '../../application/use-cases/list-user-terms-acceptances.use-case.js';
import {
  AcceptTermsVersionDto,
  CreateTermsVersionDto,
} from '../dto/terms.dto.js';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import type { AuthenticatedIdentity } from '../../../auth/application/ports/auth.inputs.js';

@ApiTags('Reglas y términos')
@Controller('terms')
@UseGuards(AuthGuard)
export class TermsController {
  constructor(
    private readonly createVersion: CreateTermsVersionUseCase,
    private readonly acceptVersion: AcceptTermsVersionUseCase,
    private readonly listUserAcceptances: ListUserTermsAcceptancesUseCase,
  ) {}

  @Post('versions')
  @UseGuards(RolesGuard)
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiBody({ type: CreateTermsVersionDto })
  @ApiOperation({ summary: 'Registrar versión de términos' })
  create(@Body() input: CreateTermsVersionDto) {
    return this.createVersion.execute(input);
  }

  @Post('acceptances')
  @ApiBody({ type: AcceptTermsVersionDto })
  @ApiOperation({ summary: 'Aceptar versión de términos' })
  accept(@Body() input: AcceptTermsVersionDto, @CurrentUser() user: AuthenticatedIdentity) {
    return this.acceptVersion.execute({
      termsVersionId: input.termsVersionId,
      acceptedAt: input.acceptedAt,
      userId: user.userId,
    });
  }

  @Get('users/:userId/acceptances')
  @ApiOperation({ summary: 'Consultar aceptaciones de términos de un usuario' })
  listByUser(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedIdentity) {
    if (user.userId !== userId && user.role === AccessRole.USER) throw new Error('No autorizado.');
    return this.listUserAcceptances.execute({ userId });
  }
}
