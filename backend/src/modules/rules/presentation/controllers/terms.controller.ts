import { ApiHttpErrors } from '../../../../shared/presentation/openapi/api-http-errors.decorator.js';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExtension,
  ApiOperation,
  ApiBody,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import {
  TermsVersionResponseDto,
  TermsAcceptanceResponseDto,
} from '../dto/rules-response.dto.js';
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

  @ApiHttpErrors(400)
  @Post('versions')
  @ApiCreatedResponse({ type: TermsVersionResponseDto })
  @UseGuards(RolesGuard)
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiBody({ type: CreateTermsVersionDto })
  @ApiOperation({ summary: 'Registrar versión de términos' })
  @ApiExtension('x-implementation-status', 'implemented')
  create(@Body() input: CreateTermsVersionDto) {
    return this.createVersion.execute(input);
  }

  @ApiHttpErrors(400, 404, 409)
  @Post('acceptances')
  @ApiCreatedResponse({
    type: TermsAcceptanceResponseDto,
    description:
      'La aceptación pertenece al usuario del token; el userId del cuerpo se valida pero no determina el propietario.',
  })
  @ApiBody({ type: AcceptTermsVersionDto })
  @ApiOperation({ summary: 'Aceptar versión de términos' })
  @ApiExtension('x-implementation-status', 'implemented')
  accept(
    @Body() input: AcceptTermsVersionDto,
    @CurrentUser() user: AuthenticatedIdentity,
  ) {
    return this.acceptVersion.execute({
      termsVersionId: input.termsVersionId,
      acceptedAt: input.acceptedAt,
      userId: user.userId,
    });
  }

  @ApiHttpErrors(403)
  @Get('users/:userId/acceptances')
  @ApiOkResponse({
    type: [TermsAcceptanceResponseDto],
    description: 'Aceptaciones propias o consultadas por personal operativo.',
  })
  @ApiOperation({ summary: 'Consultar aceptaciones de términos de un usuario' })
  @ApiExtension('x-implementation-status', 'implemented')
  listByUser(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedIdentity,
  ) {
    if (user.userId !== userId && user.role === AccessRole.USER) {
      throw new ForbiddenException(
        'No tiene permisos para consultar estas aceptaciones.',
      );
    }
    return this.listUserAcceptances.execute({ userId });
  }
}
