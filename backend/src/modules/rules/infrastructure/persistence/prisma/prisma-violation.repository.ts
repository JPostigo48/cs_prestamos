import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type { Violation } from '../../../domain/entities/violation.js';
import { calculateTrustPenalty } from '../../../domain/entities/violation.js';
import {
  ViolationRepository,
  type RegisterViolationData,
} from '../../../domain/repositories/violation.repository.js';

@Injectable()
export class PrismaViolationRepository implements ViolationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private runtime() { return this.prisma.client.runtime(); }
  private map(row: any): Violation {
    return { id: row.id, userId: row.usuarioId, ruleId: row.reglaId, ruleVersionId: row.versionReglaId, occurredAt: row.fecha, appliedPenalty: Number(row.penalizacionAplicada) };
  }
  async createWithPenalty(data: RegisterViolationData): Promise<Violation> {
    return this.prisma.client.transaction(async (tx) => {
      const users = await tx.query(this.prisma.sql.public.usuarios
        .select('id', 'confianza')
        .where((row, fns) => fns.eq(row.id, data.userId))
        .limit(1).build());
      const user = users[0];
      if (!user) throw new NotFoundException('Usuario no encontrado.');
      const previousTrust = Number(user.confianza);
      const { appliedPenalty, resultingTrust } = calculateTrustPenalty(previousTrust, data.configuredPenalty);
      const updated = await tx.query(this.prisma.sql.public.usuarios
        .update({ confianza: resultingTrust.toFixed(2) })
        .where((row, fns) => fns.eq(row.id, data.userId))
        .where((row, fns) => fns.eq(row.confianza, previousTrust.toFixed(2)))
        .returning('id').build());
      if (!updated[0]) throw new ConflictException('La confianza cambió durante el registro; reintente.');
      const rows = await tx.query(this.prisma.sql.public.incumplimientos.insert([{
        usuarioId: data.userId,
        reglaId: data.ruleId,
        versionReglaId: data.ruleVersionId,
        fecha: data.occurredAt,
        penalizacionAplicada: appliedPenalty.toFixed(2),
      }]).returning('id', 'usuarioId', 'reglaId', 'versionReglaId', 'fecha', 'penalizacionAplicada').build());
      const violation = this.map(rows[0]);
      await tx.query(this.prisma.sql.public.sanciones.insert([{
        usuarioId: data.userId,
        incumplimientoId: violation.id,
        reglaId: data.ruleId,
        versionReglaId: data.ruleVersionId,
        estado: 'ACTIVA',
        fechaInicio: new Date(),
        fechaFin: null,
        confianzaAnterior: previousTrust.toFixed(2),
        confianzaPosterior: resultingTrust.toFixed(2),
      }]).returning('id').build());
      await tx.query(this.prisma.sql.public.auditorias_usuario.insert([{
        usuarioId: data.userId,
        accion: 'CONFIANZA_ACTUALIZADA',
        datosAnteriores: JSON.stringify({ confianza: previousTrust }),
        datosNuevos: JSON.stringify({ confianza: resultingTrust, incumplimientoId: violation.id }),
      }]).returning('id').build());
      return violation;
    });
  }

  async findById(violationId: string): Promise<Violation | null> {
    const rows = await this.runtime().query(this.prisma.sql.public.incumplimientos.select('id','usuarioId','reglaId','versionReglaId','fecha','penalizacionAplicada').where((r, f) => f.eq(r.id, violationId)).limit(1).build());
    return rows[0] ? this.map(rows[0]) : null;
  }
}
