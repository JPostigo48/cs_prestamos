import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import { Temporal } from 'temporal-polyfill';
import type { Loan, LoanReturn } from '../../../domain/entities/loan.js';
import {
  LoanRepository,
  type CreateLoanData,
  type RegisterLoanReturnData,
} from '../../../domain/repositories/loan.repository.js';

@Injectable()
export class PrismaLoanRepository implements LoanRepository {
  constructor(private readonly prisma: PrismaService) {}

  private runtime() {
    return this.prisma.client.runtime();
  }

  private instant(value: Date) {
    return Temporal.Instant.from(value.toISOString());
  }

  private map(row: any, returned: any = null): Loan {
    return {
      id: row.id,
      userId: row.usuarioId,
      copyId: row.ejemplarId,
      startsAt: row.fechaInicio,
      endsAt: row.fechaFin,
      status: row.estado,
      return: returned
        ? {
            id: returned.id,
            loanId: returned.prestamoId,
            returnedAt: returned.fecha,
            observation: returned.observacion,
          }
        : null,
    };
  }

  private loanSelect() {
    return this.prisma.sql.public.prestamos.select(
      'id',
      'usuarioId',
      'ejemplarId',
      'fechaInicio',
      'fechaFin',
      'estado',
    );
  }

  private async withReturns(rows: any[]): Promise<Loan[]> {
    return Promise.all(
      rows.map(async (row) => {
        const returns = await this.runtime()
          .query(
            this.prisma.sql.public.devoluciones
              .select('id', 'prestamoId', 'fecha', 'observacion')
              .where((item, fns) => fns.eq(item.prestamoId, row.id))
              .limit(1)
              .build(),
          );
        return this.map(row, returns[0] ?? null);
      }),
    );
  }

  async create(data: CreateLoanData): Promise<Loan> {
    try {
      const rows = await this.runtime()
        .query(
          this.prisma.sql.public.prestamos
            .insert([{
              usuarioId: data.userId,
              ejemplarId: data.copyId,
              fechaInicio: this.instant(data.startsAt),
              fechaFin: this.instant(data.endsAt),
              estado: 'ACTIVO',
            }])
            .returning(
              'id',
              'usuarioId',
              'ejemplarId',
              'fechaInicio',
              'fechaFin',
              'estado',
            )
            .build(),
        );
      if (!rows[0]) throw new InternalServerErrorException('No se pudo crear el préstamo.');
      return this.map(rows[0]);
    } catch (error) {
      if (String(error).toLowerCase().includes('exclusion')) {
        throw new ConflictException('El ejemplar ya tiene un préstamo solapado.');
      }
      throw error;
    }
  }

  async createWithCopy(data: CreateLoanData): Promise<Loan> {
    try {
      const rows = await this.prisma.client.transaction(async (tx) => {
        const copyRows = await tx.query(
          this.prisma.sql.public.ejemplares
            .update({ estado: 'PRESTADO' })
            .where((row, fns) => fns.eq(row.id, data.copyId))
            .where((row, fns) => fns.eq(row.estado, 'DISPONIBLE'))
            .returning('id')
            .build(),
        );
        if (!copyRows[0]) {
          throw new ConflictException('El ejemplar no está disponible.');
        }
        const loanRows = await tx.query(
          this.prisma.sql.public.prestamos
            .insert([{
              usuarioId: data.userId,
              ejemplarId: data.copyId,
              fechaInicio: this.instant(data.startsAt),
              fechaFin: this.instant(data.endsAt),
              estado: 'ACTIVO',
            }])
            .returning(
              'id',
              'usuarioId',
              'ejemplarId',
              'fechaInicio',
              'fechaFin',
              'estado',
            )
            .build(),
        );
        if (!loanRows[0]) {
          throw new InternalServerErrorException('No se pudo crear el préstamo.');
        }
        return loanRows[0];
      });
      return this.map(rows);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new ConflictException('No se pudo crear el préstamo.');
    }
  }

  async findById(loanId: string): Promise<Loan | null> {
    const rows = await this.runtime()
      .query(
        this.loanSelect()
          .where((row, fns) => fns.eq(row.id, loanId))
          .limit(1)
          .build(),
      );
    return rows[0] ? (await this.withReturns(rows))[0] : null;
  }

  async findActive(): Promise<Loan[]> {
    const rows = await this.runtime()
      .query(
        this.loanSelect()
          .where((row, fns) => fns.eq(row.estado, 'ACTIVO'))
          .build(),
      );
    return this.withReturns(rows);
  }

  async findByUserId(userId: string): Promise<Loan[]> {
    const rows = await this.runtime()
      .query(
        this.loanSelect()
          .where((row, fns) => fns.eq(row.usuarioId, userId))
          .build(),
      );
    return this.withReturns(rows);
  }

  async findOverdue(at: Date): Promise<Loan[]> {
    const active = await this.findActive();
    return active.filter((loan) => loan.endsAt < at);
  }

  async hasOverlappingLoan(
    copyId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean> {
    const rows = await this.runtime()
      .query(
        this.loanSelect()
          .where((row, fns) => fns.eq(row.ejemplarId, copyId))
          .build(),
      );
    return rows.some(
      (row: any) =>
        row.estado !== 'FINALIZADO' &&
        new Date(row.fechaInicio).getTime() < endsAt.getTime() &&
        new Date(row.fechaFin).getTime() > startsAt.getTime(),
    );
  }

  async registerReturn(data: RegisterLoanReturnData): Promise<LoanReturn> {
    const loan = await this.findById(data.loanId);
    if (!loan || loan.return) {
      throw new ConflictException('El préstamo ya fue devuelto o no existe.');
    }
    const returned = await this.runtime().query(
      this.prisma.sql.public.devoluciones
        .insert([{
          prestamoId: data.loanId,
          fecha: this.instant(data.returnedAt),
          observacion: data.observation?.trim() || null,
        }])
        .returning('id', 'prestamoId', 'fecha', 'observacion')
        .build(),
    );
    await this.runtime()
      .query(
        this.prisma.sql.public.prestamos
          .update({ estado: 'FINALIZADO' })
          .where((row, fns) => fns.eq(row.id, data.loanId))
          .build(),
      );
    const row = returned[0];
    return {
      id: row.id,
      loanId: row.prestamoId,
      returnedAt: row.fecha,
      observation: row.observacion,
    };
  }

  async registerReturnWithCopy(data: RegisterLoanReturnData): Promise<LoanReturn> {
    return this.prisma.client.transaction(async (tx) => {
      const loanRows = await tx.query(
        this.loanSelect()
          .where((row, fns) => fns.eq(row.id, data.loanId))
          .limit(1)
          .build(),
      );
      const loan = loanRows[0];
      if (!loan) throw new ConflictException('El préstamo no existe.');
      const existingReturn = await tx.query(
        this.prisma.sql.public.devoluciones
          .select('id')
          .where((row, fns) => fns.eq(row.prestamoId, data.loanId))
          .limit(1)
          .build(),
      );
      if (existingReturn[0] || loan.estado === 'FINALIZADO') {
        throw new ConflictException('El préstamo ya fue devuelto.');
      }
      const returnedRows = await tx.query(
        this.prisma.sql.public.devoluciones
          .insert([{
            prestamoId: data.loanId,
            fecha: this.instant(data.returnedAt),
            observacion: data.observation?.trim() || null,
          }])
          .returning('id', 'prestamoId', 'fecha', 'observacion')
          .build(),
      );
      await tx.query(
        this.prisma.sql.public.prestamos
          .update({ estado: 'FINALIZADO' })
          .where((row, fns) => fns.eq(row.id, data.loanId))
          .build(),
      );
      const state = data.observation?.trim() ? 'NO_DISPONIBLE' : 'DISPONIBLE';
      const copyRows = await tx.query(
        this.prisma.sql.public.ejemplares
          .update({ estado: state })
          .where((row, fns) => fns.eq(row.id, loan.ejemplarId))
          .returning('id')
          .build(),
      );
      if (!copyRows[0]) throw new InternalServerErrorException('Ejemplar no encontrado.');
      if (data.observation?.trim()) {
        await tx.query(
          this.prisma.sql.public.observaciones_ejemplar
            .insert([{
              ejemplarId: loan.ejemplarId,
              descripcion: data.observation.trim(),
            }])
            .returning('id')
            .build(),
        );
      }
      const row = returnedRows[0];
      return {
        id: row.id,
        loanId: row.prestamoId,
        returnedAt: row.fecha,
        observation: row.observacion,
      };
    });
  }
}
