import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessRole } from '../../auth/domain/entities/access-account.js';
import type { AuthenticatedIdentity } from '../../auth/application/ports/auth.inputs.js';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard.js';
import { Roles } from '../../auth/presentation/decorators/roles.decorator.js';
import { ApiHttpErrors } from '../../../shared/presentation/openapi/api-http-errors.decorator.js';
import { ReservationSettingsRepository } from '../domain/reservation-settings.repository.js';
import {
  presentSettings,
  validateSettingsPatch,
} from '../domain/reservation-settings.js';
import {
  PatchReservationSettingsDto,
  ReservationSettingsResponseDto,
} from './reservation-settings.dto.js';

@ApiTags('Configuración del sistema')
@Controller('system/reservation-settings')
@UseGuards(AuthGuard, RolesGuard)
export class ReservationSettingsController {
  constructor(private readonly settings: ReservationSettingsRepository) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar horario de atención y espera operativa para reservas',
  })
  @ApiOkResponse({ type: ReservationSettingsResponseDto })
  @ApiHttpErrors(503)
  async read() {
    return presentSettings(await this.settings.read());
  }

  @Patch()
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Persistir configuración de reservas (solo nuevas reservas)',
  })
  @ApiBody({ type: PatchReservationSettingsDto })
  @ApiOkResponse({ type: ReservationSettingsResponseDto })
  @ApiHttpErrors(400, 503)
  async update(
    @Body() patch: PatchReservationSettingsDto,
    @Req() request: Request & { user: AuthenticatedIdentity },
  ) {
    validateSettingsPatch(patch);
    return presentSettings(
      await this.settings.update(patch, {
        accountId: request.user.accountId,
        userId: request.user.userId,
      }),
    );
  }
}
