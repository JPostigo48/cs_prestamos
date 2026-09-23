import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type { Loan, LoanReturn } from '../../../domain/entities/loan.js';
import {
  LoanRepository,
  type CreateLoanData,
  type RegisterLoanReturnData,
} from '../../../domain/repositories/loan.repository.js';

@Injectable()
export class PrismaLoanRepository implements LoanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(_data: CreateLoanData): Promise<Loan> {
    // TODO
    throw new Error('Not implemented');
  }

  async findById(_loanId: string): Promise<Loan | null> {
    // TODO
    throw new Error('Not implemented');
  }

  async findActive(): Promise<Loan[]> {
    // TODO
    throw new Error('Not implemented');
  }

  async findByUserId(_userId: string): Promise<Loan[]> {
    // TODO
    throw new Error('Not implemented');
  }

  async findOverdue(_at: Date): Promise<Loan[]> {
    // TODO
    throw new Error('Not implemented');
  }

  async hasOverlappingLoan(
    _copyId: string,
    _startsAt: Date,
    _endsAt: Date,
  ): Promise<boolean> {
    // TODO
    throw new Error('Not implemented');
  }

  async registerReturn(_data: RegisterLoanReturnData): Promise<LoanReturn> {
    // TODO
    throw new Error('Not implemented');
  }
}
