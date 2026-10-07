import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateLoanUseCase } from '../../application/use-cases/create-loan.use-case.js';
import { GetLoanUseCase } from '../../application/use-cases/get-loan.use-case.js';
import { ListActiveLoansUseCase } from '../../application/use-cases/list-active-loans.use-case.js';
import { ListOverdueLoansUseCase } from '../../application/use-cases/list-overdue-loans.use-case.js';
import { ListUserLoanHistoryUseCase } from '../../application/use-cases/list-user-loan-history.use-case.js';
import { ReturnLoanUseCase } from '../../application/use-cases/return-loan.use-case.js';
import { CreateLoanDto } from '../dto/create-loan.dto.js';
import { ReturnLoanDto } from '../dto/return-loan.dto.js';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import type { AuthenticatedIdentity } from '../../../auth/application/ports/auth.inputs.js';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';

@Controller('loans')
@UseGuards(AuthGuard)
export class LoansController {
  constructor(
    private readonly createLoan: CreateLoanUseCase,
    private readonly returnLoan: ReturnLoanUseCase,
    private readonly getLoan: GetLoanUseCase,
    private readonly listActiveLoans: ListActiveLoansUseCase,
    private readonly listUserHistory: ListUserLoanHistoryUseCase,
    private readonly listOverdueLoans: ListOverdueLoansUseCase,
  ) {}

  @Post()
  create(@Body() input: CreateLoanDto, @CurrentUser() user: AuthenticatedIdentity) {
    return this.createLoan.execute({
      copyId: input.copyId,
      startsAt: input.startsAt,
      userId: user.userId,
    });
  }

  @Get('active')
  @UseGuards(RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  listActive() {
    return this.listActiveLoans.execute();
  }

  @Get('overdue')
  @UseGuards(RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  listOverdue() {
    return this.listOverdueLoans.execute({ at: new Date() });
  }

  @Get('user/:userId/history')
  listHistory(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedIdentity) {
    if (user.userId !== userId && user.role === AccessRole.USER) {
      throw new ForbiddenException('No tiene permisos para consultar este historial.');
    }
    return this.listUserHistory.execute({ userId });
  }

  @Get(':loanId')
  async getById(
    @Param('loanId') loanId: string,
    @CurrentUser() user: AuthenticatedIdentity,
  ) {
    const loan = await this.getLoan.execute({ loanId });
    if (
      loan.userId !== user.userId &&
      user.role === AccessRole.USER
    ) {
      throw new ForbiddenException('No tiene permisos para consultar este préstamo.');
    }
    return loan;
  }

  @Post(':loanId/return')
  @UseGuards(RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
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
