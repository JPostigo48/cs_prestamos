import { ApiHttpErrors } from '../../../../shared/presentation/openapi/api-http-errors.decorator.js';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExtension,
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  LoanStatus,
} from '../../domain/entities/loan.js';
import { ReservationStatus } from '../../domain/entities/reservation.js';
import {
  LoanResponseDto,
  ReservationResponseDto,
} from '../dto/loans-response.dto.js';
import { GetLoanUseCase } from '../../application/use-cases/get-loan.use-case.js';
import { ListActiveLoansUseCase } from '../../application/use-cases/list-active-loans.use-case.js';
import { ListOverdueLoansUseCase } from '../../application/use-cases/list-overdue-loans.use-case.js';
import { ListUserLoanHistoryUseCase } from '../../application/use-cases/list-user-loan-history.use-case.js';
import { ReturnLoanUseCase } from '../../application/use-cases/return-loan.use-case.js';
import { ReturnLoanDto } from '../dto/return-loan.dto.js';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import type { AuthenticatedIdentity } from '../../../auth/application/ports/auth.inputs.js';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import { CreateReservationUseCase } from '../../application/use-cases/create-reservation.use-case.js';
import { PickupReservationUseCase } from '../../application/use-cases/pickup-reservation.use-case.js';
import { CancelReservationUseCase } from '../../application/use-cases/cancel-reservation.use-case.js';
import { CreateReservationDto } from '../dto/create-reservation.dto.js';
import { CancelReservationDto } from '../dto/cancel-reservation.dto.js';
import {
  ListReservationsUseCase,
  ListResourceHistoryUseCase,
  SaveReturnChecklistUseCase,
} from '../../application/use-cases/loan-contracts.use-cases.js';
import {
  ReservationsQueryDto,
  ResourceHistoryQueryDto,
  SaveReturnChecklistDto,
} from '../dto/loan-contracts.dto.js';
import {
  LoanHistoryPageResponseDto,
  ReservationsPageResponseDto,
  ReturnChecklistResponseDto,
} from '../dto/loans-response.dto.js';

@ApiTags('Préstamos')
@ApiBearerAuth()
@Controller('loans')
@UseGuards(AuthGuard)
export class LoansController {
  constructor(
    private readonly returnLoan: ReturnLoanUseCase,
    private readonly getLoan: GetLoanUseCase,
    private readonly listActiveLoans: ListActiveLoansUseCase,
    private readonly listUserHistory: ListUserLoanHistoryUseCase,
    private readonly listOverdueLoans: ListOverdueLoansUseCase,
    private readonly createReservation: CreateReservationUseCase,
    private readonly pickupReservation: PickupReservationUseCase,
    private readonly cancelReservationUseCase: CancelReservationUseCase,
    private readonly listReservations: ListReservationsUseCase,
    private readonly listResourceHistory: ListResourceHistoryUseCase,
    private readonly saveChecklist: SaveReturnChecklistUseCase,
  ) {}

  @Get('reservations')
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, maximum: 21474836, default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: 'status', required: false, enum: ReservationStatus })
  @ApiQuery({ name: 'userId', required: false, type: String, format: 'uuid', description: 'USUARIO solo propio; personal puede filtrar cualquier titular.' })
  @ApiQuery({ name: 'copyId', required: false, type: String, format: 'uuid', description: 'ID del ejemplar, no del artículo.' })
  @ApiExtension('x-access-constraints', 'USUARIO: solo reservas propias. OPERADOR y ADMINISTRADOR: consulta operativa, filtrable por titular.')
  @ApiHttpErrors(400, 401, 403)
  @ApiOkResponse({ type: ReservationsPageResponseDto })
  @ApiOperation({
    summary: 'Listar reservas',
    description:
      'USUARIO: solo propias. OPERADOR/ADMINISTRADOR: listado operativo filtrable. Orden fecha solicitada descendente e ID ascendente; paginación aplicada en persistencia.',
  })
  @ApiExtension('x-implementation-status', 'implemented')
  reservations(
    @Query() query: ReservationsQueryDto,
    @CurrentUser() user: AuthenticatedIdentity,
  ) {
    return this.listReservations.execute(query, user);
  }

  @Get('resource/:resourceId/history')
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, maximum: 21474836, default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: 'status', required: false, enum: LoanStatus })
  @UseGuards(RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiParam({
    name: 'resourceId',
    type: String,
    format: 'uuid',
    description:
      'ID del artículo del catálogo. Incluye todos sus ejemplares, también no disponibles.',
  })
  @ApiHttpErrors(400, 401, 403, 404)
  @ApiOkResponse({ type: LoanHistoryPageResponseDto })
  @ApiOperation({
    summary: 'Historial de préstamos del artículo',
    description:
      'Solo personal operativo. No expone el historial de otros usuarios en detalle del catálogo de USUARIO. Orden inicio descendente e ID ascendente.',
  })
  @ApiExtension('x-implementation-status', 'implemented')
  resourceHistory(
    @Param('resourceId', new ParseUUIDPipe()) id: string,
    @Query() query: ResourceHistoryQueryDto,
  ) {
    return this.listResourceHistory.execute(id, query);
  }

  @Post(':loanId/return-checklist')
  @UseGuards(RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiParam({ name: 'loanId', type: String, format: 'uuid' })
  @ApiBody({ type: SaveReturnChecklistDto })
  @ApiCreatedResponse({ type: ReturnChecklistResponseDto })
  @ApiHttpErrors(400, 401, 403, 404, 409)
  @ApiOperation({
    summary: 'Guardar inspección de devolución',
    description:
      'Captura única e inmutable de un préstamo ACTIVO, auditada con actor JWT y snapshot original. No devuelve el préstamo ni aplica sanciones. Reintentos con iguales partes recuperan la captura original, incluso tras devolver; diferencias devuelven 409. Sin snapshot histórico solo admite parts vacío. Faltantes exigen describir incidencia al ejecutar la devolución separada existente.',
  })
  @ApiExtension('x-implementation-status', 'implemented')
  returnChecklist(
    @Param('loanId', new ParseUUIDPipe()) loanId: string,
    @Body() input: SaveReturnChecklistDto,
    @CurrentUser() user: AuthenticatedIdentity,
  ) {
    return this.saveChecklist.execute({
      loanId,
      actorId: user.userId,
      checkedAt: new Date(input.checkedAt),
      parts: input.parts,
    });
  }

  @ApiHttpErrors(400, 404, 409)
  @Post('reservations')
  @ApiCreatedResponse({ type: ReservationResponseDto })
  @ApiBody({ type: CreateReservationDto })
  @ApiOperation({ summary: 'Confirmar una reserva de ejemplar' })
  @ApiExtension('x-implementation-status', 'implemented')
  createReservationEndpoint(
    @Body() input: CreateReservationDto,
    @CurrentUser() user: AuthenticatedIdentity,
  ) {
    return this.createReservation.execute({
      copyId: input.copyId,
      requestedAt: new Date(input.requestedAt),
      userId: user.userId,
    });
  }

  @ApiHttpErrors(404, 409)
  @Post('reservations/:reservationId/pickup')
  @ApiCreatedResponse({ type: LoanResponseDto })
  @UseGuards(RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Registrar recogida y crear el préstamo' })
  @ApiExtension('x-implementation-status', 'implemented')
  pickup(@Param('reservationId', new ParseUUIDPipe()) reservationId: string) {
    return this.pickupReservation.execute({
      reservationId,
      pickedUpAt: new Date(),
    });
  }

  @ApiHttpErrors(400, 409)
  @Delete('reservations/:reservationId')
  @ApiOkResponse({
    type: ReservationResponseDto,
    description: 'Solo puede cancelar el propietario de la reserva.',
  })
  @ApiBody({ type: CancelReservationDto })
  @ApiOperation({ summary: 'Cancelar una reserva confirmada' })
  @ApiExtension('x-implementation-status', 'implemented')
  cancelReservation(
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Body() input: CancelReservationDto,
    @CurrentUser() user: AuthenticatedIdentity,
  ) {
    return this.cancelReservationUseCase.execute({
      reservationId,
      reason: input.reason,
      userId: user.userId,
    });
  }

  @Get('active')
  @ApiOkResponse({ type: [LoanResponseDto] })
  @UseGuards(RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Consultar préstamos activos' })
  @ApiExtension('x-implementation-status', 'implemented')
  listActive() {
    return this.listActiveLoans.execute();
  }

  @Get('overdue')
  @ApiOkResponse({ type: [LoanResponseDto] })
  @ApiOperation({ summary: 'Consultar préstamos vencidos' })
  @UseGuards(RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiExtension('x-implementation-status', 'implemented')
  listOverdue() {
    return this.listOverdueLoans.execute({ at: new Date() });
  }

  @ApiHttpErrors(403)
  @Get('user/:userId/history')
  @ApiOkResponse({
    type: [LoanResponseDto],
    description: 'Historial propio o consultado por personal operativo.',
  })
  @ApiOperation({ summary: 'Consultar historial de préstamos de un usuario' })
  @ApiExtension('x-implementation-status', 'implemented')
  listHistory(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: AuthenticatedIdentity,
  ) {
    if (user.userId !== userId && user.role === AccessRole.USER) {
      throw new ForbiddenException(
        'No tiene permisos para consultar este historial.',
      );
    }
    return this.listUserHistory.execute({ userId });
  }

  @ApiHttpErrors(403, 404)
  @Get(':loanId')
  @ApiOkResponse({
    type: LoanResponseDto,
    description: 'Préstamo propio o consultado por personal operativo.',
  })
  @ApiOperation({ summary: 'Consultar préstamo' })
  @ApiExtension('x-implementation-status', 'implemented')
  async getById(
    @Param('loanId', new ParseUUIDPipe()) loanId: string,
    @CurrentUser() user: AuthenticatedIdentity,
  ) {
    const loan = await this.getLoan.execute({ loanId });
    if (loan.userId !== user.userId && user.role === AccessRole.USER) {
      throw new ForbiddenException(
        'No tiene permisos para consultar este préstamo.',
      );
    }
    return loan;
  }

  @ApiHttpErrors(400, 404, 409)
  @Post(':loanId/return')
  @ApiCreatedResponse({ type: LoanResponseDto })
  @UseGuards(RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiBody({ type: ReturnLoanDto })
  @ApiOperation({ summary: 'Registrar devolución' })
  @ApiExtension('x-implementation-status', 'implemented')
  registerReturn(
    @Param('loanId', new ParseUUIDPipe()) loanId: string,
    @Body() input: ReturnLoanDto,
  ) {
    return this.returnLoan.execute({
      loanId,
      returnedAt: input.returnedAt,
      observation: input.observation,
    });
  }
}
