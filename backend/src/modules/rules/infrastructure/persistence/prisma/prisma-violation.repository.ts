import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type { Violation } from '../../../domain/entities/violation.js';
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
  async create(data: RegisterViolationData): Promise<Violation> {
    const rows = await this.runtime().query(this.prisma.sql.public.incumplimientos.insert([{ usuarioId: data.userId, reglaId: data.ruleId, versionReglaId: data.ruleVersionId, fecha: data.occurredAt, penalizacionAplicada: data.appliedPenalty.toFixed(2) }]).returning('id','usuarioId','reglaId','versionReglaId','fecha','penalizacionAplicada').build());
    return this.map(rows[0]);
  }

  async findById(violationId: string): Promise<Violation | null> {
    const rows = await this.runtime().query(this.prisma.sql.public.incumplimientos.select('id','usuarioId','reglaId','versionReglaId','fecha','penalizacionAplicada').where((r, f) => f.eq(r.id, violationId)).limit(1).build());
    return rows[0] ? this.map(rows[0]) : null;
  }
}
