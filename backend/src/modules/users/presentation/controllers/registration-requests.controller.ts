import { ApiHttpErrors } from '../../../../shared/presentation/openapi/api-http-errors.decorator.js';
import {
  Body,
  Controller,
  GoneException,
  BadRequestException,
  HttpCode,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExtension,
  ApiOperation,
  ApiBody,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { RegistrationRequestStatus } from '../../domain/entities/registration-request.js';
import {
  RegistrationRequestResponseDto,
  RegistrationRequestsPageResponseDto,
  ApprovedRegistrationResponseDto,
} from '../dto/users-response.dto.js';
import { ApproveRegistrationRequestUseCase } from '../../application/use-cases/approve-registration-request.use-case.js';
import { GetRegistrationRequestUseCase } from '../../application/use-cases/get-registration-request.use-case.js';
import { RejectRegistrationRequestUseCase } from '../../application/use-cases/reject-registration-request.use-case.js';
import { SubmitRegistrationRequestUseCase } from '../../application/use-cases/submit-registration-request.use-case.js';
import { ListRegistrationRequestsUseCase } from '../../application/use-cases/list-registration-requests.use-case.js';
import { RejectRegistrationRequestDto } from '../dto/reject-registration-request.dto.js';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import type { AuthenticatedIdentity } from '../../../auth/application/ports/auth.inputs.js';
import { SupabaseStorageService } from '../../../../shared/infrastructure/storage/supabase-storage.service.js';
import { registrationEvidenceMetadata } from '../../../../shared/domain/registration-evidence.js';

@ApiTags('Usuarios')
@Controller('users/registration-requests')
export class RegistrationRequestsController {
  constructor(
    private readonly submitRequest: SubmitRegistrationRequestUseCase,
    private readonly getRequest: GetRegistrationRequestUseCase,
    private readonly approveRequest: ApproveRegistrationRequestUseCase,
    private readonly rejectRequest: RejectRegistrationRequestUseCase,
    private readonly listRequests: ListRegistrationRequestsUseCase,
    private readonly storage: SupabaseStorageService,
  ) {}

  @ApiHttpErrors(410)
  @Post()
  @HttpCode(410)
  @ApiOperation({
    summary: 'Entrada básica retirada',
    deprecated: true,
    description:
      'Siempre responde 410 y no crea solicitudes. Enviar el registro integral a POST /auth/registration-requests.',
  })
  @ApiExtension('x-implementation-status', 'implemented')
  submit() {
    throw new GoneException(
      'La entrada básica fue retirada. Envíe el registro completo a POST /auth/registration-requests.',
    );
  }

  @Get()
  @ApiOkResponse({ type: RegistrationRequestsPageResponseDto })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RegistrationRequestStatus,
  })
  @ApiQuery({ name: 'institutionalId', required: false, type: String })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Por defecto 1; normalizado a un mínimo de 1.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Por defecto 20; normalizado entre 1 y 100.',
  })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiExtension('x-implementation-status', 'implemented')
  list(
    @Query()
    query: {
      status?: string;
      institutionalId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.listRequests.execute(query);
  }

  @ApiHttpErrors(404)
  @Get(':requestId')
  @ApiOkResponse({ type: RegistrationRequestResponseDto })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Consultar solicitud de registro' })
  @ApiExtension('x-implementation-status', 'implemented')
  getById(@Param('requestId') requestId: string) {
    return this.getRequest.execute({ requestId });
  }

  @Get(':requestId/evidence/:evidenceIndex')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Obtener URL firmada de una evidencia de vinculación',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { url: { type: 'string' } },
    },
  })
  async getEvidence(
    @Param('requestId') requestId: string,
    @Param('evidenceIndex', ParseIntPipe) evidenceIndex: number,
  ) {
    const request = await this.getRequest.execute({ requestId });
    const evidence = request.evidence[evidenceIndex];
    const metadata = registrationEvidenceMetadata(evidence?.information);
    if (!metadata) {
      throw new BadRequestException(
        'Esta evidencia no está almacenada como documento en Supabase.',
      );
    }
    return {
      url: await this.storage.createSignedUrl(metadata.path, metadata.bucket),
    };
  }

  @ApiHttpErrors(404, 409)
  @Post(':requestId/approve')
  @ApiCreatedResponse({ type: ApprovedRegistrationResponseDto })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Aprobar solicitud de registro',
    description:
      'OPERADOR o ADMINISTRADOR. Toda aprobación crea atómicamente usuario con vinculación vigente y confianza 75, cuenta habilitada USUARIO con el correo y hash originales y aceptación original de términos. No emite sesión ni devuelve credenciales. 409 antes de escribir si faltan correo válido, credenciales Argon2id, aceptación/versión existente o imagen PNG/JPEG de hasta 60 KiB: rechazar con motivo y solicitar un nuevo envío integral. Consultar approvalBlockers en listado/detalle.',
  })
  @ApiExtension('x-implementation-status', 'implemented')
  approve(
    @Param('requestId') requestId: string,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.approveRequest.execute({ requestId }, actor);
  }

  @ApiHttpErrors(400, 404, 409)
  @Post(':requestId/reject')
  @ApiBody({ type: RejectRegistrationRequestDto })
  @ApiCreatedResponse({ type: RegistrationRequestResponseDto })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Rechazar solicitud de registro' })
  @ApiExtension('x-implementation-status', 'implemented')
  reject(
    @Param('requestId') requestId: string,
    @Body() body: RejectRegistrationRequestDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.rejectRequest.execute(
      {
        requestId,
        rejectionReason: body.rejectionReason,
      },
      actor,
    );
  }
}
