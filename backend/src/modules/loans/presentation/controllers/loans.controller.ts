import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiTags } from '@nestjs/swagger';
import { CreateLoanUseCase } from '../../application/use-cases/create-loan.use-case.js';
import { GetLoanUseCase } from '../../application/use-cases/get-loan.use-case.js';
import { ListActiveLoansUseCase } from '../../application/use-cases/list-active-loans.use-case.js';
import { ListOverdueLoansUseCase } from '../../application/use-cases/list-overdue-loans.use-case.js';
import { ListUserLoanHistoryUseCase } from '../../application/use-cases/list-user-loan-history.use-case.js';
import { ReturnLoanUseCase } from '../../application/use-cases/return-loan.use-case.js';
import { CreateLoanDto } from '../dto/create-loan.dto.js';
import { ReturnLoanDto } from '../dto/return-loan.dto.js';

@ApiTags('Préstamos')
@Controller('loans')
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
  @ApiBody({ type: CreateLoanDto })
  @ApiOperation({ summary: 'Registrar préstamo' })
  create(@Body() input: CreateLoanDto) {
    return this.createLoan.execute(input);
  }

  @Get('active')
  @ApiOperation({ summary: 'Consultar préstamos activos' })
  listActive() {
    return this.listActiveLoans.execute();
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Consultar préstamos vencidos' })
  listOverdue() {
    return this.listOverdueLoans.execute({ at: new Date() });
  }

  @Get('user/:userId/history')
  @ApiOperation({ summary: 'Consultar historial de préstamos de un usuario' })
  listHistory(@Param('userId') userId: string) {
    return this.listUserHistory.execute({ userId });
  }

  @Get(':loanId')
  @ApiOperation({ summary: 'Consultar préstamo' })
  getById(@Param('loanId') loanId: string) {
    return this.getLoan.execute({ loanId });
  }

  @Post(':loanId/return')
  @ApiBody({ type: ReturnLoanDto })
  @ApiOperation({ summary: 'Registrar devolución' })
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
