import { Injectable } from '@nestjs/common';
import { Temporal } from 'temporal-polyfill';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  TermsAcceptance,
  TermsVersion,
} from '../../../domain/entities/terms.js';
import {
  TermsRepository,
  type AcceptTermsVersionData,
  type CreateTermsVersionData,
} from '../../../domain/repositories/terms.repository.js';

@Injectable()
export class PrismaTermsRepository implements TermsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private runtime() { return this.prisma.client.runtime(); }
  private mapVersion(row: any): TermsVersion {
    return { id: row.id, number: row.numero, title: row.titulo, content: row.contenido };
  }
  async createVersion(data: CreateTermsVersionData): Promise<TermsVersion> {
    const rows = await this.runtime().query(this.prisma.sql.public.versiones_terminos.insert([{ numero: data.number, titulo: data.title ?? null, contenido: data.content ?? null }]).returning('id','numero','titulo','contenido').build());
    return this.mapVersion(rows[0]);
  }

  async findVersionById(versionId: string): Promise<TermsVersion | null> {
    const rows = await this.runtime().query(this.prisma.sql.public.versiones_terminos.select('id','numero','titulo','contenido').where((r, f) => f.eq(r.id, versionId)).limit(1).build());
    return rows[0] ? this.mapVersion(rows[0]) : null;
  }

  async accept(data: AcceptTermsVersionData): Promise<TermsAcceptance> {
    try {
      const rows = await this.runtime().query(this.prisma.sql.public.aceptaciones_terminos.insert([{ usuarioId: data.userId, versionTerminosId: data.termsVersionId, fecha: Temporal.Instant.from(data.acceptedAt.toISOString()) }]).returning('id','usuarioId','versionTerminosId','fecha').build());
      return { id: rows[0].id, userId: rows[0].usuarioId, termsVersionId: rows[0].versionTerminosId, acceptedAt: new Date(rows[0].fecha.epochMilliseconds) };
    } catch (error) {
      if (String(error).toLowerCase().includes('unique')) throw new Error('Los términos ya fueron aceptados.');
      throw error;
    }
  }

  async findAcceptancesByUserId(userId: string): Promise<TermsAcceptance[]> {
    const rows = await this.runtime().query(this.prisma.sql.public.aceptaciones_terminos.select('id','usuarioId','versionTerminosId','fecha').where((r, f) => f.eq(r.usuarioId, userId)).build());
    return rows.map((r: any) => ({ id: r.id, userId: r.usuarioId, termsVersionId: r.versionTerminosId, acceptedAt: new Date(r.fecha.epochMilliseconds) }));
  }

  async hasAcceptedCurrentVersion(userId: string): Promise<boolean> {
    const versions = await this.runtime().query(
      this.prisma.sql.public.versiones_terminos.select('id', 'numero').build(),
    );
    if (versions.length === 0) return false;
    const current = versions.reduce((latest: any, version: any) =>
      !latest || version.numero > latest.numero ? version : latest,
    );
    const acceptances = await this.runtime().query(
      this.prisma.sql.public.aceptaciones_terminos
        .select('id')
        .where((row, fns) => fns.eq(row.usuarioId, userId))
        .where((row, fns) => fns.eq(row.versionTerminosId, current.id))
        .limit(1)
        .build(),
    );
    return Boolean(acceptances[0]);
  }
}
