import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import { instantToDate, nullableInstantToDate } from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import {
  type LoanEligibility,
  deriveTrustLevel,
  type Sanction,
  type User,
  type UserTrustProfile,
} from '../../../domain/entities/user.js';
import { UserRepository } from '../../../domain/repositories/user.repository.js';

export function isEffectiveActiveSanction(
  sanction: Pick<Sanction, 'status' | 'startsAt' | 'endsAt'>,
  at: Date,
): boolean {
  return (sanction.status === 'ACTIVA' || sanction.status === 'PROGRAMADA') &&
    sanction.startsAt <= at &&
    (sanction.endsAt === null || sanction.endsAt > at);
}

export function effectiveSanctionStatus(
  sanction: Pick<Sanction, 'status' | 'startsAt' | 'endsAt'>,
  at: Date,
): Sanction['status'] {
  if (sanction.status === 'ABSUELTA') return 'ABSUELTA';
  if (sanction.endsAt !== null && sanction.endsAt <= at) return 'FINALIZADA';
  if (sanction.startsAt > at) return 'PROGRAMADA';
  return 'ACTIVA';
}

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
    const now = new Date();
    const activeSanctions = sanctions.filter((sanction) => isEffectiveActiveSanction(sanction, now));
    const active = activeSanctions.length > 0;
    const reasons = [
      ...(user.hasCurrentAffiliation ? [] : ['VINCULACION_NO_VIGENTE']),
      ...(active ? ['SANCION_ACTIVA'] : []),
    ];
    return { userId, enabled: reasons.length === 0, eligible: reasons.length === 0, reasons, hasCurrentAffiliation: user.hasCurrentAffiliation, institutionalType: user.userType, activeSanctions, trustPercentage: user.trustPercentage, trustLevel: deriveTrustLevel(user.trustPercentage) };
  }

  async getTrustProfile(userId: string): Promise<UserTrustProfile> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const sanctions = await this.listSanctions(userId);
    const now = new Date();
    return { userId, percentage: user.trustPercentage, level: deriveTrustLevel(user.trustPercentage), currentlyPenalized: sanctions.some((sanction) => isEffectiveActiveSanction(sanction, now)) };
  }

  async listSanctions(userId: string): Promise<Sanction[]> {
    const rows = await this.runtime().query(this.prisma.sql.public.sanciones.select('id', 'usuarioId', 'incumplimientoId', 'reglaId', 'versionReglaId', 'estado', 'fechaInicio', 'fechaFin', 'confianzaAnterior', 'confianzaPosterior').where((row, fns) => fns.eq(row.usuarioId, userId)).build());
    return rows.map((row: any) => {
      const startsAt = instantToDate(row.fechaInicio);
      const endsAt = nullableInstantToDate(row.fechaFin);
      return { id: row.id, userId: row.usuarioId, violationId: row.incumplimientoId, ruleId: row.reglaId, ruleVersionId: row.versionReglaId, status: effectiveSanctionStatus({ status: row.estado, startsAt, endsAt }, new Date()), startsAt, endsAt, previousTrust: Number(row.confianzaAnterior), resultingTrust: Number(row.confianzaPosterior) };
    });
  }
}
