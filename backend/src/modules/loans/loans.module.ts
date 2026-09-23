import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { UsersModule } from '../users/users.module.js';
import { LoanInventoryPort } from './application/ports/loan-inventory.port.js';
import { UserLoanEligibilityPort } from './application/ports/user-loan-eligibility.port.js';
import { CreateLoanUseCase } from './application/use-cases/create-loan.use-case.js';
import { GetLoanUseCase } from './application/use-cases/get-loan.use-case.js';
import { ListActiveLoansUseCase } from './application/use-cases/list-active-loans.use-case.js';
import { ListOverdueLoansUseCase } from './application/use-cases/list-overdue-loans.use-case.js';
import { ListUserLoanHistoryUseCase } from './application/use-cases/list-user-loan-history.use-case.js';
import { ReturnLoanUseCase } from './application/use-cases/return-loan.use-case.js';
import { LoanRepository } from './domain/repositories/loan.repository.js';
import { InventoryLoansAdapter } from './infrastructure/integration/inventory-loans.adapter.js';
import { UsersLoanEligibilityAdapter } from './infrastructure/integration/users-loan-eligibility.adapter.js';
import { PrismaLoanRepository } from './infrastructure/persistence/prisma/prisma-loan.repository.js';
import { LoansController } from './presentation/controllers/loans.controller.js';

const useCases = [
  CreateLoanUseCase,
  ReturnLoanUseCase,
  GetLoanUseCase,
  ListActiveLoansUseCase,
  ListUserLoanHistoryUseCase,
  ListOverdueLoansUseCase,
];

@Module({
  imports: [UsersModule, InventoryModule],
  controllers: [LoansController],
  providers: [
    ...useCases,
    {
      provide: LoanRepository,
      useClass: PrismaLoanRepository,
    },
    {
      provide: UserLoanEligibilityPort,
      useClass: UsersLoanEligibilityAdapter,
    },
    {
      provide: LoanInventoryPort,
      useClass: InventoryLoansAdapter,
    },
  ],
  exports: [GetLoanUseCase, ListUserLoanHistoryUseCase],
})
export class LoansModule {}
