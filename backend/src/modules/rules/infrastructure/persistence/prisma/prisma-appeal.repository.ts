import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type { Appeal } from '../../../domain/entities/appeal.js';
import {
  AppealRepository,
  type ResolveAppealData,
  type SubmitAppealData,
} from '../../../domain/repositories/appeal.repository.js';

@Injectable()
export class PrismaAppealRepository implements AppealRepository {
  constructor(private readonly prisma: PrismaService) {}

  private runtime() { return this.prisma.client.runtime(); }
  private map(row: any): Appeal {
    return { id: row.id, violationId: row.incumplimientoId, userId: row.usuarioId, reason: row.motivo, submittedAt: row.fecha, status: row.estado, resolution: row.resolucion, resolvedAt: row.fechaResolucion, resolvedByAccountId: row.resueltaPorCuentaId };
  }
  async create(data: SubmitAppealData): Promise<Appeal> {
    const rows = await this.runtime().query(this.prisma.sql.public.apelaciones.insert([{ incumplimientoId: data.violationId, usuarioId: data.userId, motivo: data.reason, fecha: data.submittedAt }]).returning('id','incumplimientoId','usuarioId','motivo','fecha','estado','resolucion','fechaResolucion','resueltaPorCuentaId').build());
    return this.map(rows[0]);
  }

  async findById(appealId: string): Promise<Appeal | null> {
    const rows = await this.runtime().query(this.prisma.sql.public.apelaciones.select('id','incumplimientoId','usuarioId','motivo','fecha','estado','resolucion','fechaResolucion','resueltaPorCuentaId').where((r, f) => f.eq(r.id, appealId)).limit(1).build());
    return rows[0] ? this.map(rows[0]) : null;
  }

  async findByViolationId(violationId: string): Promise<Appeal | null> {
    const rows = await this.runtime().query(this.prisma.sql.public.apelaciones.select('id','incumplimientoId','usuarioId','motivo','fecha','estado','resolucion','fechaResolucion','resueltaPorCuentaId').where((r, f) => f.eq(r.incumplimientoId, violationId)).limit(1).build());
    return rows[0] ? this.map(rows[0]) : null;
  }

  async resolve(data: ResolveAppealData): Promise<Appeal> {
    return this.prisma.client.transaction(async (tx) => {
      const rows = await tx.query(this.prisma.sql.public.apelaciones
        .update({ estado: data.status, resolucion: data.resolution, fechaResolucion: data.resolvedAt, resueltaPorCuentaId: data.resolvedByAccountId })
        .where((r, f) => f.eq(r.id, data.appealId))
        .where((r, f) => f.eq(r.estado, 'PENDIENTE'))
        .returning('id','incumplimientoId','usuarioId','motivo','fecha','estado','resolucion','fechaResolucion','resueltaPorCuentaId').build());
      const appeal = rows[0];
      if (!appeal) throw new ConflictException('La apelación ya fue resuelta o no existe.');
      if (data.status === 'ACEPTADA') {
        await tx.query(this.prisma.sql.public.sanciones
          .update({ estado: 'ABSUELTA' })
          .where((r, f) => f.eq(r.incumplimientoId, appeal.incumplimientoId))
          .where((r, f) => f.eq(r.estado, 'ACTIVA'))
          .returning('id').build());
      }
      return this.map(appeal);
    });
  }
}
