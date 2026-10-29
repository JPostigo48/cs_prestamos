import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Temporal } from 'temporal-polyfill';
import type { AuditActor } from '../../../../../shared/application/audit-actor.js';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import {
  instantToDate,
  nullableInstantToDate,
} from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import {
  type LoanEligibility,
  deriveTrustLevel,
  type Sanction,
  type User,
  type UserTrustProfile,
} from '../../../domain/entities/user.js';
import {
  UserRepository,
  type ManagedUserData,
} from '../../../domain/repositories/user.repository.js';

type QueryRuntime = Pick<
  ReturnType<PrismaService['client']['runtime']>,
  'query'
>;

import { effectiveSanctionStatus, isEffectiveActiveSanction } from '../../../../rules/domain/entities/sanction-schedule.js';
export { effectiveSanctionStatus, isEffectiveActiveSanction } from '../../../../rules/domain/entities/sanction-schedule.js';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private runtime() {
    return this.prisma.client.runtime();
  }

  private async audit(
    data: {
      usuarioId: string;
      accion: string;
      datosAnteriores?: unknown;
      datosNuevos?: unknown;
    },
    runtime: QueryRuntime = this.runtime(),
  ) {
    await runtime.query(
      this.prisma.sql.public.auditorias_usuario
        .insert([
          {
            usuarioId: data.usuarioId,
            accion: data.accion,
            datosAnteriores:
              data.datosAnteriores === undefined
                ? null
                : JSON.stringify(data.datosAnteriores),
            datosNuevos:
              data.datosNuevos === undefined
                ? null
                : JSON.stringify(data.datosNuevos),
          },
        ])
        .returning('id')
        .build(),
    );
  }

  private map(row: any): User {
    return {
      id: row.id,
      name: row.nombre,
      userType: row.tipoUsuario,
      institutionalId: row.identificadorInstitucional,
      hasCurrentAffiliation: row.vinculacionVigente,
      trustPercentage: Number(row.confianza),
    };
  }

  private async ensureNoPendingRequest(
    runtime: QueryRuntime,
    institutionalId: string | null | undefined,
  ) {
    if (!institutionalId) return;
    const requests = await runtime.query(
      this.prisma.sql.public.solicitudes_registro
        .select('id')
        .where((row, fns) =>
          fns.eq(row.identificadorInstitucional, institutionalId),
        )
        .where((row, fns) => fns.eq(row.estado, 'PENDIENTE'))
        .limit(1)
        .build(),
    );
    if (requests[0])
      throw new ConflictException(
        'Existe una solicitud pendiente; utilice el flujo de aprobación.',
      );
  }

  async createManaged(data: ManagedUserData, actor: AuditActor): Promise<User> {
    return this.prisma.client.transaction(async (tx) => {
      await this.ensureNoPendingRequest(tx, data.institutionalId);
      const rows = await tx.query(
        this.prisma.sql.public.usuarios
          .insert([
            {
              nombre: data.name,
              tipoUsuario: data.userType,
              identificadorInstitucional: data.institutionalId,
              vinculacionVigente: data.hasCurrentAffiliation,
              confianza: '75.00',
            },
          ])
          .returning(
            'id',
            'nombre',
            'tipoUsuario',
            'identificadorInstitucional',
            'vinculacionVigente',
            'confianza',
          )
          .build(),
      );
      const user = this.map(rows[0]);
      await this.audit(
        {
          usuarioId: user.id,
          accion: 'USUARIO_CREADO',
          datosNuevos: { actor, user },
        },
        tx,
      );
      return user;
    });
  }

  async updateManaged(
    userId: string,
    data: Partial<ManagedUserData>,
    actor: AuditActor,
    action = 'USUARIO_EDITADO',
  ): Promise<User> {
    return this.writeUser(userId, data, actor, action);
  }

  private async writeUser(
    userId: string,
    data: Partial<ManagedUserData>,
    actor: AuditActor | undefined,
    action: string,
  ): Promise<User> {
    return this.prisma.client.transaction(async (tx) => {
      // Bloquea la fila como el flujo de reservas: baja y nueva operación se serializan.
      const previous = await tx.query(
        this.prisma.sql.public.usuarios
          .update({ updatedAt: Temporal.Now.instant() })
          .where((row, fns) => fns.eq(row.id, userId))
          .returning(
            'id',
            'nombre',
            'tipoUsuario',
            'identificadorInstitucional',
            'vinculacionVigente',
            'confianza',
          )
          .build(),
      );
      if (!previous[0]) throw new NotFoundException('Usuario no encontrado.');
      if (
        data.institutionalId !== undefined &&
        data.institutionalId !== previous[0].identificadorInstitucional
      ) {
        await this.ensureNoPendingRequest(tx, data.institutionalId);
      }
      if (data.hasCurrentAffiliation === false) {
        const reservations = await tx.query(
          this.prisma.sql.public.reservas
            .select('id')
            .where((row, fns) => fns.eq(row.usuarioId, userId))
            .where((row, fns) => fns.eq(row.estado, 'CONFIRMADA'))
            .limit(1)
            .build(),
        );
        const loans = await tx.query(
          this.prisma.sql.public.prestamos
            .select('id')
            .where((row, fns) => fns.eq(row.usuarioId, userId))
            .where((row, fns) => fns.ne(row.estado, 'FINALIZADO'))
            .limit(1)
            .build(),
        );
        if (reservations[0] || loans[0])
          throw new ConflictException(
            'Debe resolver las reservas y préstamos abiertos antes de dar de baja al usuario.',
          );
      }
      const rows = await tx.query(
        this.prisma.sql.public.usuarios
          .update({
            ...(data.name !== undefined ? { nombre: data.name } : {}),
            ...(data.userType !== undefined
              ? { tipoUsuario: data.userType }
              : {}),
            ...(data.institutionalId !== undefined
              ? { identificadorInstitucional: data.institutionalId }
              : {}),
            ...(data.hasCurrentAffiliation !== undefined
              ? { vinculacionVigente: data.hasCurrentAffiliation }
              : {}),
          })
          .where((row, fns) => fns.eq(row.id, userId))
          .returning(
            'id',
            'nombre',
            'tipoUsuario',
            'identificadorInstitucional',
            'vinculacionVigente',
            'confianza',
          )
          .build(),
      );
      const user = this.map(rows[0]);
      await this.audit(
        {
          usuarioId: userId,
          accion: action,
          datosAnteriores: this.map(previous[0]),
          datosNuevos: { actor, user },
        },
        tx,
      );
      return user;
    });
  }

  async save(user: User): Promise<User> {
    const rows = await this.runtime().query(
      this.prisma.sql.public.usuarios
        .insert([
          {
            id: user.id,
            nombre: user.name,
            tipoUsuario: user.userType,
            identificadorInstitucional: user.institutionalId,
            vinculacionVigente: user.hasCurrentAffiliation,
            confianza: user.trustPercentage.toFixed(2),
          },
        ])
        .returning(
          'id',
          'nombre',
          'tipoUsuario',
          'identificadorInstitucional',
          'vinculacionVigente',
          'confianza',
        )
        .build(),
    );
    return this.map(rows[0]);
  }

  async findById(userId: string): Promise<User | null> {
    const rows = await this.runtime().query(
      this.prisma.sql.public.usuarios
        .select(
          'id',
          'nombre',
          'tipoUsuario',
          'identificadorInstitucional',
          'vinculacionVigente',
          'confianza',
        )
        .where((row, fns) => fns.eq(row.id, userId))
        .limit(1)
        .build(),
    );
    return rows[0] ? this.map(rows[0]) : null;
  }

  async findByInstitutionalId(institutionalId: string): Promise<User | null> {
    const rows = await this.runtime().query(
      this.prisma.sql.public.usuarios
        .select(
          'id',
          'nombre',
          'tipoUsuario',
          'identificadorInstitucional',
          'vinculacionVigente',
          'confianza',
        )
        .where((row, fns) =>
          fns.eq(row.identificadorInstitucional, institutionalId),
        )
        .limit(1)
        .build(),
    );
    return rows[0] ? this.map(rows[0]) : null;
  }

  async updateAffiliationStatus(
    userId: string,
    hasCurrentAffiliation: boolean,
  ): Promise<User> {
    return this.writeUser(
      userId,
      { hasCurrentAffiliation },
      undefined,
      'VINCULACION_ACTUALIZADA',
    );
  }

  async list(filters: {
    userType?: string;
    hasCurrentAffiliation?: boolean;
    institutionalId?: string;
    page: number;
    limit: number;
  }) {
    let base = this.prisma.sql.public.usuarios.select(
      'id',
      'nombre',
      'tipoUsuario',
      'identificadorInstitucional',
      'vinculacionVigente',
      'confianza',
    );
    if (filters.userType)
      base = base.where((row, fns) =>
        fns.eq(row.tipoUsuario, filters.userType!),
      );
    if (filters.hasCurrentAffiliation !== undefined)
      base = base.where((row, fns) =>
        fns.eq(row.vinculacionVigente, filters.hasCurrentAffiliation!),
      );
    if (filters.institutionalId)
      base = base.where((row, fns) =>
        fns.eq(row.identificadorInstitucional, filters.institutionalId!),
      );
    const rows = await this.runtime().query(
      base
        .offset((filters.page - 1) * filters.limit)
        .limit(filters.limit)
        .build(),
    );
    const total = (await this.runtime().query(base.build())).length;
    return {
      items: rows.map((row: any) => this.map(row)),
      total,
      page: filters.page,
      limit: filters.limit,
    };
  }

  async getLoanEligibility(userId: string): Promise<LoanEligibility> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const sanctions = await this.listSanctions(userId);
    const now = new Date();
    const activeSanctions = sanctions.filter((sanction) =>
      isEffectiveActiveSanction(sanction, now),
    );
    const active = activeSanctions.length > 0;
    const reasons = [
      ...(user.hasCurrentAffiliation ? [] : ['VINCULACION_NO_VIGENTE']),
      ...(active ? ['SANCION_ACTIVA'] : []),
    ];
    return {
      userId,
      enabled: reasons.length === 0,
      eligible: reasons.length === 0,
      reasons,
      hasCurrentAffiliation: user.hasCurrentAffiliation,
      institutionalType: user.userType,
      activeSanctions,
      trustPercentage: user.trustPercentage,
      trustLevel: deriveTrustLevel(user.trustPercentage),
    };
  }

  async getTrustProfile(userId: string): Promise<UserTrustProfile> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const sanctions = await this.listSanctions(userId);
    const now = new Date();
    return {
      userId,
      percentage: user.trustPercentage,
      level: deriveTrustLevel(user.trustPercentage),
      currentlyPenalized: sanctions.some((sanction) =>
        isEffectiveActiveSanction(sanction, now),
      ),
    };
  }

  async listSanctions(userId: string): Promise<Sanction[]> {
    const rows = await this.runtime().query(
      this.prisma.sql.public.sanciones
        .select(
          'id',
          'usuarioId',
          'incumplimientoId',
          'reglaId',
          'versionReglaId',
          'estado',
          'fechaInicio',
          'fechaFin',
          'confianzaAnterior',
          'confianzaPosterior',
        )
        .where((row, fns) => fns.eq(row.usuarioId, userId))
        .build(),
    );
    return rows.map((row: any) => {
      const startsAt = instantToDate(row.fechaInicio);
      const endsAt = nullableInstantToDate(row.fechaFin);
      return {
        id: row.id,
        userId: row.usuarioId,
        violationId: row.incumplimientoId,
        ruleId: row.reglaId,
        ruleVersionId: row.versionReglaId,
        status: effectiveSanctionStatus(
          { status: row.estado, startsAt, endsAt },
          new Date(),
        ),
        startsAt,
        endsAt,
        previousTrust: Number(row.confianzaAnterior),
        resultingTrust: Number(row.confianzaPosterior),
      };
    });
  }
}
