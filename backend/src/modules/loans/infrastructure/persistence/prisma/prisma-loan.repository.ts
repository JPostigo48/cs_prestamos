import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import { instantToDate } from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import { Temporal } from 'temporal-polyfill/full';
import type {
  Loan,
  ReturnChecklist,
} from '../../../domain/entities/loan.js';
import type {
  Page,
  ResourceHistoryQuery,
  SaveReturnChecklistData,
} from '../../../domain/repositories/loan-queries.js';
import { inspectionParts } from '../../../domain/entities/return-inspection.js';
import {
  LoanRepository,
} from '../../../domain/repositories/loan.repository.js';

import { PrismaLoanClosure } from './prisma-loan-closure.js';
import { restoreClosedLoan, type CloseLoanData } from '../../../domain/entities/loan-closure.js';
import type { KnownSchemaCapabilities } from '../../../../../shared/infrastructure/prisma/schema-capabilities.js';

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
      startsAt: instantToDate(row.fechaInicio),
      endsAt: instantToDate(row.fechaFin),
      status: row.estado,
      configurationSnapshot: row.configurationSnapshot ?? null,
      returnChecklist: null,
      closure: null, consequences: [], reward: null, copy: null, cancelledReservationIds: [],
      return: returned
        ? {
            id: returned.id,
            loanId: returned.prestamoId,
            returnedAt: instantToDate(returned.fecha),
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
      'configurationSnapshot',
    );
  }

  private async withReturns(rows: any[]): Promise<Loan[]> {
    const read = (snapshot: KnownSchemaCapabilities) => this.readReturns(rows, snapshot);
    return this.prisma.schemaCapabilities.read('loanClosure', 'loans.read', read, read);
  }

  private async readReturns(rows: any[], snapshot: KnownSchemaCapabilities): Promise<Loan[]> {
    // Read only the actual columns required, independent of write constraints.
    const closureHistoryAvailable = ['prestamoId', 'resultado'].every(
      (name) => snapshot.capabilities[`column:cierres_prestamo.${name}`] === true,
    );
    return Promise.all(
      rows.map(async (row) => {
        const closed = closureHistoryAvailable ? await this.runtime().query(
          this.prisma.sql.public.cierres_prestamo.select('resultado')
            .where((r, f) => f.eq(r.prestamoId, row.id)).limit(1).build(),
        ) : [];
        const closureHistory = closureHistoryAvailable ? 'AVAILABLE' : 'UNAVAILABLE';
        if (closed[0]) return { ...restoreClosedLoan(closed[0].resultado), closureHistory };
        const returns = await this.runtime().query(
          this.prisma.sql.public.devoluciones
            .select('id', 'prestamoId', 'fecha', 'observacion')
            .where((item, fns) => fns.eq(item.prestamoId, row.id))
            .limit(1)
            .build(),
        );
        const inspections = await this.runtime().query(
          this.checklistSelect()
            .where((item, fns) => fns.eq(item.prestamoId, row.id))
            .limit(1)
            .build(),
        );
        return {
          ...this.map(row, returns[0] ?? null),
          closureHistory,
          returnChecklist: inspections[0]
            ? this.mapChecklist(inspections[0])
            : null,
        };
      }),
    );
  }

  private checklistSelect() {
    return this.prisma.sql.public.inspecciones_devolucion.select(
      'id',
      'prestamoId',
      'actorId',
      'checkedAt',
      'configurationSnapshot',
      'parts',
    );
  }

  private mapChecklist(row: any): ReturnChecklist {
    return {
      id: row.id,
      loanId: row.prestamoId,
      actorId: row.actorId,
      checkedAt: instantToDate(row.checkedAt),
      configurationSnapshot: row.configurationSnapshot ?? null,
      parts: row.parts,
    };
  }

  async findResourceHistory(
    resourceId: string,
    query: ResourceHistoryQuery,
  ): Promise<Page<Loan>> {
    const resources = await this.runtime().query(
      this.prisma.sql.public.recursos
        .select('id')
        .where((r, f) => f.eq(r.id, resourceId))
        .limit(1)
        .build(),
    );
    if (!resources[0]) throw new NotFoundException('Recurso no encontrado.');
    const copies = await this.runtime().query(
      this.prisma.sql.public.ejemplares
        .select('id')
        .where((r, f) => f.eq(r.recursoId, resourceId))
        .build(),
    );
    if (!copies.length)
      return { items: [], total: 0, page: query.page, limit: query.limit };
    const filter = (base: ReturnType<PrismaLoanRepository['loanSelect']>) =>
      base.where((r, f) =>
        f.and(
          f.in(
            r.ejemplarId,
            copies.map((c) => c.id),
          ),
          ...(query.status ? [f.eq(r.estado, query.status)] : []),
        ),
      );
    const counts = await this.runtime().query(
      this.prisma.sql.public.prestamos
        .select((_r, f) => ({ total: f.count() }))
        .where((r, f) =>
          f.and(
            f.in(
              r.ejemplarId,
              copies.map((c) => c.id),
            ),
            ...(query.status ? [f.eq(r.estado, query.status)] : []),
          ),
        )
        .build(),
    );
    const rows = await this.runtime().query(
      filter(this.loanSelect())
        .orderBy((r) => r.fechaInicio, { direction: 'desc' })
        .orderBy((r) => r.id, { direction: 'asc' })
        .limit(query.limit)
        .offset((query.page - 1) * query.limit)
        .build(),
    );
    return {
      items: await this.withReturns(rows),
      total: Number(counts[0]?.total ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async saveReturnChecklist(
    data: SaveReturnChecklistData,
  ): Promise<ReturnChecklist> {
    return this.prisma.client.transaction(async (tx) => {
      // Bloqueo compartido con devolución. No cambia el estado ni el ejemplar.
      const rows = await tx.query(
        this.prisma.sql.public.prestamos
          .update({ updatedAt: Temporal.Now.instant() })
          .where((r, f) => f.eq(r.id, data.loanId))
          .returning('id', 'estado', 'fechaInicio', 'configurationSnapshot')
          .build(),
      );
      const loan = rows[0];
      if (!loan) throw new NotFoundException('Préstamo no encontrado.');
      const parts = inspectionParts(
        (loan.configurationSnapshot as Loan['configurationSnapshot']) ?? null,
        data.parts,
      );
      const previous = await tx.query(
        this.checklistSelect()
          .where((r, f) => f.eq(r.prestamoId, data.loanId))
          .limit(1)
          .build(),
      );
      if (previous[0]) {
        const existing = this.mapChecklist(previous[0]);
        if (JSON.stringify(existing.parts) !== JSON.stringify(parts))
          throw new ConflictException(
            'La inspección es inmutable; ya existe otra captura.',
          );
        return existing; // Reintento incluso después de devolver: sin doble efecto.
      }
      if (loan.estado !== 'ACTIVO')
        throw new ConflictException('Solo se inspeccionan préstamos activos.');
      if (
        !Number.isFinite(data.checkedAt.getTime()) ||
        data.checkedAt < instantToDate(loan.fechaInicio) ||
        data.checkedAt.getTime() > Date.now()
      )
        throw new ConflictException(
          'La inspección debe estar entre el inicio del préstamo y la hora actual.',
        );
      const inserted = await tx.query(
        this.prisma.sql.public.inspecciones_devolucion
          .insert([
            {
              prestamoId: data.loanId,
              actorId: data.actorId,
              checkedAt: this.instant(data.checkedAt),
              configurationSnapshot: loan.configurationSnapshot ?? null,
              parts: parts.map((p) => ({ ...p })),
            },
          ])
          .returning(
            'id',
            'prestamoId',
            'actorId',
            'checkedAt',
            'configurationSnapshot',
            'parts',
          )
          .build(),
      );
      return this.mapChecklist(inserted[0]);
    });
  }

  async findById(loanId: string): Promise<Loan | null> {
    const rows = await this.runtime().query(
      this.loanSelect()
        .where((row, fns) => fns.eq(row.id, loanId))
        .limit(1)
        .build(),
    );
    return rows[0] ? (await this.withReturns(rows))[0] : null;
  }

  async findActive(): Promise<Loan[]> {
    const rows = await this.runtime().query(
      this.loanSelect()
        .where((row, fns) => fns.eq(row.estado, 'ACTIVO'))
        .build(),
    );
    return this.withReturns(rows);
  }

  async findByUserId(userId: string): Promise<Loan[]> {
    const rows = await this.runtime().query(
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
    const rows = await this.runtime().query(
      this.loanSelect()
        .where((row, fns) => fns.eq(row.ejemplarId, copyId))
        .build(),
    );
    return rows.some(
      (row: any) =>
        (row.estado === 'ACTIVO' || row.estado === 'PLANIFICADO') &&
        instantToDate(row.fechaInicio).getTime() < endsAt.getTime() &&
        instantToDate(row.fechaFin).getTime() > startsAt.getTime(),
    );
  }

  closeLoan(data: CloseLoanData): Promise<Loan> {
    return new PrismaLoanClosure(this.prisma).close(data);
  }

  readReturnPolicy(loanId: string) {
    return new PrismaLoanClosure(this.prisma).readReturnPolicy(loanId);
  }
}
