import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  RuleStatus,
  RuleVersion,
  UsageRule,
} from '../../../domain/entities/usage-rule.js';
import {
  RuleRepository,
  type RuleVersionData,
} from '../../../domain/repositories/rule.repository.js';

@Injectable()
export class PrismaRuleRepository implements RuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private runtime() { return this.prisma.client.runtime(); }
  private version(row: any): RuleVersion {
    return { id: row.id, ruleId: row.reglaId, number: row.numero, title: row.titulo, description: row.descripcion, penaltyPercentage: Number(row.penalizacionPorcentual), consequence: row.consecuencia, suspensionType: row.tipoSuspension, suspensionDays: row.diasSuspension, status: row.estado };
  }

  async create(data: RuleVersionData): Promise<UsageRule> {
    return this.prisma.client.transaction(async (tx) => {
      const rule = (await tx.query(this.prisma.sql.public.reglas_uso.insert([{}]).returning('id').build()))[0];
      const version = (await tx.query(this.prisma.sql.public.versiones_regla.insert([{ reglaId: rule.id, numero: 1, titulo: data.title, descripcion: data.description, penalizacionPorcentual: data.penaltyPercentage.toFixed(2), consecuencia: data.consequence, tipoSuspension: data.suspensionType, diasSuspension: data.suspensionDays ?? null, estado: 'ACTIVA' }]).returning('id').build()))[0];
      await tx.query(this.prisma.sql.public.reglas_uso.update({ versionVigenteId: version.id }).where((r, f) => f.eq(r.id, rule.id)).build());
      return { id: rule.id, currentVersionId: version.id, versions: [this.version({ ...version, reglaId: rule.id, numero: 1, titulo: data.title, descripcion: data.description, penalizacionPorcentual: data.penaltyPercentage, consecuencia: data.consequence, tipoSuspension: data.suspensionType, diasSuspension: data.suspensionDays ?? null, estado: 'ACTIVA' })] };
    });
  }

  async findById(ruleId: string): Promise<UsageRule | null> {
    const rules = await this.runtime().query(this.prisma.sql.public.reglas_uso.select('id', 'versionVigenteId').where((r, f) => f.eq(r.id, ruleId)).limit(1).build());
    if (!rules[0]) return null;
    const rows = await this.runtime().query(this.prisma.sql.public.versiones_regla.select('id','reglaId','numero','titulo','descripcion','penalizacionPorcentual','consecuencia','tipoSuspension','diasSuspension','estado').where((r, f) => f.eq(r.reglaId, ruleId)).build());
    return { id: rules[0].id, currentVersionId: rules[0].versionVigenteId, versions: rows.map((r: any) => this.version(r)) };
  }

  async addVersion(ruleId: string, data: RuleVersionData): Promise<RuleVersion> {
    const rule = await this.findById(ruleId);
    if (!rule) throw new Error('Regla no encontrada.');
    const number = Math.max(0, ...rule.versions.map((v) => v.number)) + 1;
    return this.prisma.client.transaction(async (tx) => {
      const rows = await tx.query(this.prisma.sql.public.versiones_regla.insert([{ reglaId: ruleId, numero: number, titulo: data.title, descripcion: data.description, penalizacionPorcentual: data.penaltyPercentage.toFixed(2), consecuencia: data.consequence, tipoSuspension: data.suspensionType, diasSuspension: data.suspensionDays ?? null, estado: 'ACTIVA' }]).returning('id','reglaId','numero','titulo','descripcion','penalizacionPorcentual','consecuencia','tipoSuspension','diasSuspension','estado').build());
      const version = rows[0];
      await tx.query(this.prisma.sql.public.reglas_uso.update({ versionVigenteId: version.id }).where((r, f) => f.eq(r.id, ruleId)).build());
      return this.version(version);
    });
  }

  async setStatus(ruleId: string, status: RuleStatus): Promise<RuleVersion> {
    const rule = await this.findById(ruleId);
    const current = rule?.versions.find((v) => v.id === rule.currentVersionId);
    if (!current) throw new Error('Regla no encontrada.');
    const rows = await this.runtime().query(this.prisma.sql.public.versiones_regla.update({ estado: status }).where((r, f) => f.eq(r.id, current.id)).returning('id','reglaId','numero','titulo','descripcion','penalizacionPorcentual','consecuencia','tipoSuspension','diasSuspension','estado').build());
    return this.version(rows[0]);
  }

  async findActiveVersions(): Promise<RuleVersion[]> {
    const rows = await this.runtime().query(this.prisma.sql.public.versiones_regla.select('id','reglaId','numero','titulo','descripcion','penalizacionPorcentual','consecuencia','tipoSuspension','diasSuspension','estado').where((r, f) => f.eq(r.estado, 'ACTIVA')).build());
    return rows.map((r: any) => this.version(r));
  }
}
