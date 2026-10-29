import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { ReturnLoanInput } from '../ports/loans.inputs.js';
import type { Loan } from '../../domain/entities/loan.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';

@Injectable()
export class ReturnLoanUseCase {
  constructor(private readonly loans: LoanRepository) {}

  async execute(input: ReturnLoanInput): Promise<Loan> {
    const loan = await this.loans.findById(input.loanId);
    if (!loan) throw new NotFoundException('Préstamo no encontrado.');
    if (loan.status !== 'ACTIVO' && loan.status !== 'PLANIFICADO') {
      throw new ConflictException('El préstamo ya fue finalizado.');
    }
    if (input.returnedAt < loan.startsAt) {
      throw new ConflictException(
        'La devolución no puede preceder al préstamo.',
      );
    }
    await this.loans.registerReturnWithCopy(input);
    const completed = await this.loans.findById(input.loanId);
    if (!completed || completed.status !== 'FINALIZADO' || !completed.return)
      throw new InternalServerErrorException(
        'No se pudo confirmar la devolución persistida. Consulte el estado antes de reintentar.',
      );
    return completed;
  }
}
