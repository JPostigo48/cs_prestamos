import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateLoanUseCase } from '../../application/use-cases/create-loan.use-case.js';
import { GetLoanUseCase } from '../../application/use-cases/get-loan.use-case.js';
import { ListActiveLoansUseCase } from '../../application/use-cases/list-active-loans.use-case.js';
import { ListOverdueLoansUseCase } from '../../application/use-cases/list-overdue-loans.use-case.js';
import { ListUserLoanHistoryUseCase } from '../../application/use-cases/list-user-loan-history.use-case.js';
import { ReturnLoanUseCase } from '../../application/use-cases/return-loan.use-case.js';
import { CreateLoanDto } from '../dto/create-loan.dto.js';
import { ReturnLoanDto } from '../dto/return-loan.dto.js';

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
  create(@Body() input: CreateLoanDto) {
    return this.createLoan.execute(input);
  }

  @Get('active')
  listActive() {
    return this.listActiveLoans.execute();
  }

  @Get('overdue')
  listOverdue() {
    return this.listOverdueLoans.execute({ at: new Date() });
  }

  @Get('user/:userId/history')
  listHistory(@Param('userId') userId: string) {
    return this.listUserHistory.execute({ userId });
  }

  @Get(':loanId')
  getById(@Param('loanId') loanId: string) {
    return this.getLoan.execute({ loanId });
  }

  @Post(':loanId/return')
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
