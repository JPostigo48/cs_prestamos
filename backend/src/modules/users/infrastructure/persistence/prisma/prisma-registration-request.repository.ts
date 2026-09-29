import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  RegistrationRequest,
  RegistrationRequestStatus,
} from '../../../domain/entities/registration-request.js';
import type { User } from '../../../domain/entities/user.js';
import {
  RegistrationRequestRepository,
  type CreateRegistrationRequestData,
  type RegistrationRequestFilters,
} from '../../../domain/repositories/registration-request.repository.js';

@Injectable()
export class PrismaRegistrationRequestRepository extends RegistrationRequestRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private runtime() {
    return this.prisma.client.runtime();
  }

  private map(row: any, evidence: any[] = []): RegistrationRequest {
    return {
      id: row.id,
      name: row.nombre,
      userType: row.tipoUsuario,
      institutionalId: row.identificadorInstitucional,
      requestedAt: row.fechaSolicitud,
      status: row.estado,
      rejectionReason: row.motivoRechazo ?? null,
      approvedUserId: row.usuarioAprobadoId,
      evidence: evidence.map((item) => ({ information: item.informacion })),
    };
  }

  private async audit(data: { solicitudRegistroId?: string; usuarioId?: string; accion: string; motivo?: string | null; datosAnteriores?: unknown; datosNuevos?: unknown }, runtime: any = this.runtime()) {
    await runtime.query(this.prisma.sql.public.auditorias_usuario.insert([{
      solicitudRegistroId: data.solicitudRegistroId ?? null,
      usuarioId: data.usuarioId ?? null,
      accion: data.accion,
      motivo: data.motivo ?? null,
      datosAnteriores: data.datosAnteriores === undefined ? null : JSON.stringify(data.datosAnteriores),
      datosNuevos: data.datosNuevos === undefined ? null : JSON.stringify(data.datosNuevos),
    }]).returning('id').build());
  }

  private async withEvidence(row: any, runtime = this.runtime()) {
    const evidenceQuery = this.prisma.sql.public.evidencias_vinculacion
      .select('informacion')
      .where((item, fns) => fns.eq(item.solicitudRegistroId, row.id))
      .build();
    return this.map(row, await runtime.query(evidenceQuery));
  }

  async create(data: CreateRegistrationRequestData): Promise<RegistrationRequest> {
    const query = this.prisma.sql.public.solicitudes_registro
      .insert([{ nombre: data.name, tipoUsuario: data.userType, identificadorInstitucional: data.institutionalId }])
      .returning('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'fechaSolicitud', 'estado', 'motivoRechazo', 'usuarioAprobadoId')
      .build();
    const rows = await this.runtime().query(query);
    const row = rows[0];
    if (!row) throw new Error('No se pudo crear la solicitud.');
    if (data.evidence.length) {
      await this.runtime().query(this.prisma.sql.public.evidencias_vinculacion
        .insert(data.evidence.map((informacion) => ({ solicitudRegistroId: row.id, informacion })))
        .returning('id').build());
    }
    await this.audit({ solicitudRegistroId: row.id, accion: 'SOLICITUD_CREADA', datosNuevos: { estado: 'PENDIENTE' } });
    return this.withEvidence(row);
  }

  async findById(requestId: string): Promise<RegistrationRequest | null> {
    const query = this.prisma.sql.public.solicitudes_registro
      .select('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'fechaSolicitud', 'estado', 'motivoRechazo', 'usuarioAprobadoId')
      .where((row, fns) => fns.eq(row.id, requestId)).limit(1).build();
    const rows = await this.runtime().query(query);
    return rows[0] ? this.withEvidence(rows[0]) : null;
  }

  async findPendingByInstitutionalId(institutionalId: string): Promise<RegistrationRequest | null> {
    const query = this.prisma.sql.public.solicitudes_registro
      .select('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'fechaSolicitud', 'estado', 'motivoRechazo', 'usuarioAprobadoId')
      .where((row, fns) => fns.eq(row.identificadorInstitucional, institutionalId))
      .where((row, fns) => fns.eq(row.estado, 'PENDIENTE')).limit(1).build();
    const rows = await this.runtime().query(query);
    return rows[0] ? this.withEvidence(rows[0]) : null;
  }

  async list(filters: RegistrationRequestFilters) {
    let base = this.prisma.sql.public.solicitudes_registro
      .select('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'fechaSolicitud', 'estado', 'motivoRechazo', 'usuarioAprobadoId');
    if (filters.status) base = base.where((row, fns) => fns.eq(row.estado, filters.status!));
    if (filters.institutionalId) base = base.where((row, fns) => fns.eq(row.identificadorInstitucional, filters.institutionalId!));
    const rows = await this.runtime().query(base.offset((filters.page - 1) * filters.limit).limit(filters.limit).build());
    const countRows = await this.runtime().query(base.build());
    return { items: await Promise.all(rows.map((row: any) => this.withEvidence(row))), total: countRows.length, page: filters.page, limit: filters.limit };
  }

  async updateStatus(
    requestId: string,
    status: RegistrationRequestStatus,
    rejectionReason?: string,
    approvedUserId?: string,
  ): Promise<RegistrationRequest> {
    const query = this.prisma.sql.public.solicitudes_registro.update({
      estado: status,
      motivoRechazo: rejectionReason ?? null,
      ...(approvedUserId !== undefined ? { usuarioAprobadoId: approvedUserId } : {}),
    }).where((row, fns) => fns.eq(row.id, requestId)).returning('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'fechaSolicitud', 'estado', 'motivoRechazo', 'usuarioAprobadoId').build();
    const rows = await this.runtime().query(query);
    if (!rows[0]) throw new Error('Solicitud no encontrada.');
    await this.audit({ solicitudRegistroId: requestId, accion: status === 'RECHAZADA' ? 'SOLICITUD_RECHAZADA' : 'SOLICITUD_ACTUALIZADA', motivo: rejectionReason, datosNuevos: { estado: status } });
    return this.withEvidence(rows[0]);
  }

  async approveAndCreateUser(requestId: string): Promise<{ request: RegistrationRequest; user: User }> {
    return this.prisma.client.transaction(async (tx) => {
      const requestQuery = this.prisma.sql.public.solicitudes_registro.select('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'fechaSolicitud', 'estado', 'motivoRechazo', 'usuarioAprobadoId').where((row, fns) => fns.eq(row.id, requestId)).build();
      const requestRows = await tx.query(requestQuery);
      const request = requestRows[0];
      if (!request || request.estado !== 'PENDIENTE') throw new ConflictException('Solicitud no pendiente.');
      if (request.identificadorInstitucional) {
        const existing = await tx.query(this.prisma.sql.public.usuarios.select('id').where((row, fns) => fns.eq(row.identificadorInstitucional, request.identificadorInstitucional!)).where((row, fns) => fns.eq(row.vinculacionVigente, true)).limit(1).build());
        if (existing.length) throw new ConflictException('El identificador institucional ya está vinculado.');
      }
      const userRows = await tx.query(this.prisma.sql.public.usuarios.insert([{ nombre: request.nombre, tipoUsuario: request.tipoUsuario, identificadorInstitucional: request.identificadorInstitucional, vinculacionVigente: true, confianza: '100.00' }]).returning('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'vinculacionVigente', 'confianza').build());
      const userRow = userRows[0];
      if (!userRow) throw new Error('No se pudo crear el usuario.');
      const updatedRows = await tx.query(this.prisma.sql.public.solicitudes_registro.update({ estado: 'APROBADA', motivoRechazo: null, usuarioAprobadoId: userRow.id }).where((row, fns) => fns.eq(row.id, requestId)).where((row, fns) => fns.eq(row.estado, 'PENDIENTE')).returning('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'fechaSolicitud', 'estado', 'motivoRechazo', 'usuarioAprobadoId').build());
      const updated = updatedRows[0];
      if (!updated) throw new ConflictException('La solicitud fue procesada concurrentemente.');
      await this.audit({ solicitudRegistroId: requestId, usuarioId: userRow.id, accion: 'SOLICITUD_APROBADA', datosNuevos: { estado: 'APROBADA', usuarioAprobadoId: userRow.id } }, tx);
      const evidenceRows = await tx.query(this.prisma.sql.public.evidencias_vinculacion.select('informacion').where((row, fns) => fns.eq(row.solicitudRegistroId, requestId)).build());
      return { request: this.map(updated, evidenceRows), user: { id: userRow.id, name: userRow.nombre, userType: userRow.tipoUsuario, institutionalId: userRow.identificadorInstitucional, hasCurrentAffiliation: userRow.vinculacionVigente, trustPercentage: Number(userRow.confianza) } };
    });
  }
}
