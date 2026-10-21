import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ReturnLoanInput } from '../ports/loans.inputs.js';
import type { Loan } from '../../domain/entities/loan.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class ReturnLoanUseCase {
  constructor(
    private readonly loans: LoanRepository,
  ) {}

  async execute(input: ReturnLoanInput): Promise<Loan> {
    const loan = await this.loans.findById(input.loanId);
    if (!loan) throw new NotFoundException('Préstamo no encontrado.');
    if (loan.status !== 'ACTIVO' && loan.status !== 'PLANIFICADO') {
      throw new ConflictException('El préstamo ya fue finalizado.');
    }
    if (input.returnedAt < loan.startsAt) {
      throw new ConflictException('La devolución no puede preceder al préstamo.');
    }
    await this.loans.registerReturnWithCopy(input);
    return (await this.loans.findById(input.loanId)) ?? loan;
  }
}
