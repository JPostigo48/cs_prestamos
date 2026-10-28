import { ApiHttpErrors } from '../../../../shared/presentation/openapi/api-http-errors.decorator.js';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExtension,
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
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

@ApiTags('Préstamos')
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
  ) {}

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
  pickup(@Param('reservationId') reservationId: string) {
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
    @Param('reservationId') reservationId: string,
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
    @Param('userId') userId: string,
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
    @Param('loanId') loanId: string,
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
    @Param('loanId') loanId: string,
    @Body() input: ReturnLoanDto,
  ) {
    return this.returnLoan.execute({
      loanId,
      returnedAt: input.returnedAt,
      observation: input.observation,
    });
  }
}
