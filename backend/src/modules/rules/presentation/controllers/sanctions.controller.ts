import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AppealStatus } from '../../domain/entities/appeal.js';
import { ApiHttpErrors } from '../../../../shared/presentation/openapi/api-http-errors.decorator.js';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';
import type { AuthenticatedIdentity } from '../../../auth/application/ports/auth.inputs.js';
import { ManageSanctionsUseCase } from '../../application/use-cases/manage-sanctions.use-case.js';
import {
  AppealsPageResponseDto,
  AppealsQueryDto,
  LiftSanctionDto,
  SanctionDetailResponseDto,
  SuspendUserDto,
} from '../dto/sanction.dto.js';

@ApiTags('Reglas y términos')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class SanctionsController {
  constructor(private readonly sanctions: ManageSanctionsUseCase) {}

  @Get('appeals')
  @ApiExtension('x-access-constraints', 'USUARIO: solo apelaciones propias. OPERADOR y ADMINISTRADOR: consulta operativa.')
  @Roles(AccessRole.USER, AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Listar apelaciones',
    description:
      'USUARIO: exclusivamente propias en servidor. Personal: filtros operativos. Orden fecha descendente e ID ascendente; paginación persistida.',
  })
  @ApiExtension('x-implementation-status', 'implemented')
  @ApiHttpErrors(400, 401, 403)
  @ApiOkResponse({ type: AppealsPageResponseDto })
  @ApiQuery({ name: 'status', enum: AppealStatus, required: false })
  @ApiQuery({
    name: 'userId',
    type: String,
    format: 'uuid',
    required: false,
    description:
      'USUARIO solo propio; personal puede filtrar cualquier usuario.',
  })
  @ApiQuery({
    name: 'sanctionId',
    type: String,
    format: 'uuid',
    required: false,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  })
  list(
    @Query() query: AppealsQueryDto,
    @CurrentUser() identity: AuthenticatedIdentity,
  ) {
    return this.sanctions.listAppeals(query, identity);
  }

  @Get('sanctions/:sanctionId')
  @ApiExtension('x-access-constraints', 'USUARIO: solo sanciones propias. OPERADOR y ADMINISTRADOR: consulta operativa.')
  @Roles(AccessRole.USER, AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Consultar sanción y fundamento histórico',
    description:
      'Titular o personal. Sin reconstruir datos desconocidos ni sustituir la versión histórica.',
  })
  @ApiExtension('x-implementation-status', 'implemented')
  @ApiParam({ name: 'sanctionId', type: String, format: 'uuid' })
  @ApiHttpErrors(400, 401, 403, 404)
  @ApiOkResponse({ type: SanctionDetailResponseDto })
  detail(
    @Param('sanctionId', ParseUUIDPipe) id: string,
    @CurrentUser() identity: AuthenticatedIdentity,
  ) {
    return this.sanctions.detail(id, identity);
  }

  @Post('users/:userId/suspensions')
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Suspender mediante política versionada',
    description:
      'Registra actor, motivo, horario y descuento real. Cancela reservas confirmadas y libera únicamente sus ejemplares reservados, nunca préstamos activos. No deshabilita cuentas. requestId conserva idempotencia por usuario.',
  })
  @ApiExtension('x-implementation-status', 'implemented')
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @ApiBody({ type: SuspendUserDto })
  @ApiHttpErrors(400, 401, 403, 404, 409)
  @ApiCreatedResponse({ type: SanctionDetailResponseDto })
  suspend(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() data: SuspendUserDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.sanctions.suspend({
      ...data,
      userId,
      actor,
      startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
      endsAt:
        data.endsAt === undefined
          ? undefined
          : data.endsAt === null
            ? null
            : new Date(data.endsAt),
    });
  }

  @Post('sanctions/:sanctionId/lift')
  @HttpCode(200)
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Levantar suspensión sin absolver',
    description:
      'Finaliza estado y calendario, reencadena temporales programadas conservando duración y registra resolución/actor. No restituye confianza ni elimina incumplimiento. Reintento con igual resolución devuelve la original; distinta resolución: 409.',
  })
  @ApiExtension('x-implementation-status', 'implemented')
  @ApiParam({ name: 'sanctionId', type: String, format: 'uuid' })
  @ApiBody({ type: LiftSanctionDto })
  @ApiHttpErrors(400, 401, 403, 404, 409)
  @ApiOkResponse({ type: SanctionDetailResponseDto })
  lift(
    @Param('sanctionId', ParseUUIDPipe) id: string,
    @Body() data: LiftSanctionDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.sanctions.lift(id, data.resolution, actor);
  }
}
