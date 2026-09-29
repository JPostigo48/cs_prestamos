import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  LoanEligibility,
  Sanction,
  User,
  UserTrustProfile,
} from '../../../domain/entities/user.js';
import {
  UserRepository,
  type ApplyTrustPenaltyData,
} from '../../../domain/repositories/user.repository.js';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private runtime() {
    return this.prisma.client.runtime();
  }

  private async audit(data: { usuarioId: string; accion: string; datosAnteriores?: unknown; datosNuevos?: unknown }) {
    await this.runtime().query(this.prisma.sql.public.auditorias_usuario.insert([{
      usuarioId: data.usuarioId,
      accion: data.accion,
      datosAnteriores: data.datosAnteriores === undefined ? null : JSON.stringify(data.datosAnteriores),
      datosNuevos: data.datosNuevos === undefined ? null : JSON.stringify(data.datosNuevos),
    }]).returning('id').build());
  }

  private map(row: any): User {
    return { id: row.id, name: row.nombre, userType: row.tipoUsuario, institutionalId: row.identificadorInstitucional, hasCurrentAffiliation: row.vinculacionVigente, trustPercentage: Number(row.confianza) };
  }

  async save(user: User): Promise<User> {
    const rows = await this.runtime().query(this.prisma.sql.public.usuarios.insert([{ id: user.id, nombre: user.name, tipoUsuario: user.userType, identificadorInstitucional: user.institutionalId, vinculacionVigente: user.hasCurrentAffiliation, confianza: user.trustPercentage.toFixed(2) }]).returning('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'vinculacionVigente', 'confianza').build());
    return this.map(rows[0]);
  }

  async findById(userId: string): Promise<User | null> {
    const rows = await this.runtime().query(this.prisma.sql.public.usuarios.select('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'vinculacionVigente', 'confianza').where((row, fns) => fns.eq(row.id, userId)).limit(1).build());
    return rows[0] ? this.map(rows[0]) : null;
  }

  async findByInstitutionalId(institutionalId: string): Promise<User | null> {
    const rows = await this.runtime().query(this.prisma.sql.public.usuarios.select('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'vinculacionVigente', 'confianza').where((row, fns) => fns.eq(row.identificadorInstitucional, institutionalId)).limit(1).build());
    return rows[0] ? this.map(rows[0]) : null;
  }

  async updateAffiliationStatus(userId: string, hasCurrentAffiliation: boolean): Promise<User> {
    const rows = await this.runtime().query(this.prisma.sql.public.usuarios.update({ vinculacionVigente: hasCurrentAffiliation }).where((row, fns) => fns.eq(row.id, userId)).returning('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'vinculacionVigente', 'confianza').build());
    if (!rows[0]) throw new NotFoundException('Usuario no encontrado.');
    await this.audit({ usuarioId: userId, accion: 'VINCULACION_ACTUALIZADA', datosAnteriores: { vinculacionVigente: !hasCurrentAffiliation }, datosNuevos: { vinculacionVigente: hasCurrentAffiliation } });
    return this.map(rows[0]);
  }

  async list(filters: { userType?: string; hasCurrentAffiliation?: boolean; institutionalId?: string; page: number; limit: number }) {
    let base = this.prisma.sql.public.usuarios.select('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'vinculacionVigente', 'confianza');
    if (filters.userType) base = base.where((row, fns) => fns.eq(row.tipoUsuario, filters.userType!));
    if (filters.hasCurrentAffiliation !== undefined) base = base.where((row, fns) => fns.eq(row.vinculacionVigente, filters.hasCurrentAffiliation!));
    if (filters.institutionalId) base = base.where((row, fns) => fns.eq(row.identificadorInstitucional, filters.institutionalId!));
    const rows = await this.runtime().query(base.offset((filters.page - 1) * filters.limit).limit(filters.limit).build());
    const total = (await this.runtime().query(base.build())).length;
    return { items: rows.map((row: any) => this.map(row)), total, page: filters.page, limit: filters.limit };
  }

  async getLoanEligibility(userId: string): Promise<LoanEligibility> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const sanctions = await this.listSanctions(userId);
    const active = sanctions.some((sanction) => sanction.status === 'ACTIVA');
    const reasons = [
      ...(user.hasCurrentAffiliation ? [] : ['VINCULACION_NO_VIGENTE']),
      ...(active ? ['SANCION_ACTIVA'] : []),
    ];
    return { userId, enabled: reasons.length === 0, eligible: reasons.length === 0, reasons, hasCurrentAffiliation: user.hasCurrentAffiliation, activeSanctions: sanctions.filter((sanction) => sanction.status === 'ACTIVA'), trustPercentage: user.trustPercentage, trustLevel: user.trustPercentage >= 80 ? 'NIVEL_4' : user.trustPercentage >= 60 ? 'NIVEL_3' : user.trustPercentage >= 40 ? 'NIVEL_2' : 'NIVEL_1' };
  }

  async getTrustProfile(userId: string): Promise<UserTrustProfile> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const sanctions = await this.listSanctions(userId);
    return { userId, percentage: user.trustPercentage, level: user.trustPercentage >= 80 ? 'NIVEL_4' : user.trustPercentage >= 60 ? 'NIVEL_3' : user.trustPercentage >= 40 ? 'NIVEL_2' : 'NIVEL_1', currentlyPenalized: sanctions.some((sanction) => sanction.status === 'ACTIVA') };
  }

  async applyTrustPenalty(data: ApplyTrustPenaltyData): Promise<UserTrustProfile> {
    const user = await this.findById(data.userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const next = Math.max(0, user.trustPercentage - data.penaltyPercentage);
    await this.runtime().query(this.prisma.sql.public.usuarios.update({ confianza: next.toFixed(2) }).where((row, fns) => fns.eq(row.id, data.userId)).returning('id').build());
    await this.audit({ usuarioId: data.userId, accion: 'CONFIANZA_ACTUALIZADA', datosAnteriores: { confianza: user.trustPercentage }, datosNuevos: { confianza: next }, });
    return this.getTrustProfile(data.userId);
  }

  async listSanctions(userId: string): Promise<Sanction[]> {
    const rows = await this.runtime().query(this.prisma.sql.public.sanciones.select('id', 'usuarioId', 'incumplimientoId', 'reglaId', 'versionReglaId', 'estado', 'fechaInicio', 'fechaFin', 'confianzaAnterior', 'confianzaPosterior').where((row, fns) => fns.eq(row.usuarioId, userId)).build());
    return rows.map((row: any) => ({ id: row.id, userId: row.usuarioId, violationId: row.incumplimientoId, ruleId: row.reglaId, ruleVersionId: row.versionReglaId, status: row.estado, startsAt: row.fechaInicio, endsAt: row.fechaFin, previousTrust: Number(row.confianzaAnterior), resultingTrust: Number(row.confianzaPosterior) }));
  }
}
