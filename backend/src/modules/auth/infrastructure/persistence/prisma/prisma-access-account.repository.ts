import { Injectable } from '@nestjs/common';
import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Temporal } from 'temporal-polyfill';
import type { AuditActor } from '../../../../../shared/application/audit-actor.js';
import { instantToDate } from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type { AccessAccount } from '../../../domain/entities/access-account.js';
import {
  AccessAccountRepository,
  type CreateAccessAccountData,
  type UpdateAccessAccountData,
} from '../../../domain/repositories/access-account.repository.js';

@Injectable()
export class PrismaAccessAccountRepository implements AccessAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  private runtime() {
    return this.prisma.client.runtime();
  }

  private instant(value: Date) {
    return Temporal.Instant.from(value.toISOString());
  }

  private map(row: any): AccessAccount {
    return {
      id: row.id,
      userId: row.usuarioId,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.rol,
      enabled: row.habilitada,
      lastAccessAt: row.ultimoAcceso ? instantToDate(row.ultimoAcceso) : null,
    };
  }

  private select() {
    return this.prisma.sql.public.cuentas_acceso.select(
      'id',
      'usuarioId',
      'email',
      'passwordHash',
      'rol',
      'habilitada',
      'ultimoAcceso',
    );
  }

  async create(data: CreateAccessAccountData): Promise<AccessAccount> {
    try {
      const rows = await this.runtime().query(
        this.prisma.sql.public.cuentas_acceso
          .insert([
            {
              usuarioId: data.userId,
              email: data.email,
              passwordHash: data.passwordHash,
              rol: data.role,
              habilitada: true,
            },
          ])
          .returning(
            'id',
            'usuarioId',
            'email',
            'passwordHash',
            'rol',
            'habilitada',
            'ultimoAcceso',
          )
          .build(),
      );
      return this.map(rows[0]);
    } catch (error) {
      if (String(error).toLowerCase().includes('unique')) {
        throw new ConflictException('La cuenta o el correo ya existe.');
      }
      throw new InternalServerErrorException('No se pudo crear la cuenta.');
    }
  }

  async findById(accountId: string): Promise<AccessAccount | null> {
    const rows = await this.runtime().query(
      this.select()
        .where((row, fns) => fns.eq(row.id, accountId))
        .limit(1)
        .build(),
    );
    return rows[0] ? this.map(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<AccessAccount | null> {
    const rows = await this.runtime().query(
      this.select()
        .where((row, fns) => fns.eq(row.email, email))
        .limit(1)
        .build(),
    );
    return rows[0] ? this.map(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<AccessAccount | null> {
    const rows = await this.runtime().query(
      this.select()
        .where((row, fns) => fns.eq(row.usuarioId, userId))
        .limit(1)
        .build(),
    );
    return rows[0] ? this.map(rows[0]) : null;
  }

  async recordAccess(accountId: string, accessedAt: Date): Promise<void> {
    await this.runtime().query(
      this.prisma.sql.public.cuentas_acceso
        .update({ ultimoAcceso: this.instant(accessedAt) })
        .where((row, fns) => fns.eq(row.id, accountId))
        .build(),
    );
  }

  async update(
    accountId: string,
    data: UpdateAccessAccountData,
    actor?: AuditActor,
  ): Promise<AccessAccount> {
    return this.prisma.client.transaction(async (tx) => {
      const before = await tx.query(
        this.select()
          .where((r, f) => f.eq(r.id, accountId))
          .limit(1)
          .build(),
      );
      const account = before[0] ? this.map(before[0]) : null;
      if (!account) {
        throw new InternalServerErrorException(
          'No se pudo actualizar la cuenta.',
        );
      }
      const changes = {
        ...(data.role === undefined ? {} : { rol: data.role }),
        ...(data.enabled === undefined ? {} : { habilitada: data.enabled }),
      };
      const rows = await tx.query(
        this.prisma.sql.public.cuentas_acceso
          .update(changes)
          .where((row, fns) => fns.eq(row.id, accountId))
          .where((row, fns) => fns.eq(row.rol, account.role))
          .where((row, fns) => fns.eq(row.habilitada, account.enabled))
          .returning(
            'id',
            'usuarioId',
            'email',
            'passwordHash',
            'rol',
            'habilitada',
            'ultimoAcceso',
          )
          .build(),
      );
      if (!rows[0]) {
        throw new ConflictException(
          'La cuenta cambió concurrentemente. Consulte de nuevo.',
        );
      }
      await tx.query(
        this.prisma.sql.public.auditorias_usuario
          .insert([
            {
              usuarioId: account.userId,
              accion:
                data.role === undefined
                  ? 'CUENTA_ACCESO_ACTUALIZADA'
                  : 'ROL_CUENTA_ACCESO_ACTUALIZADO',
              datosAnteriores: JSON.stringify({
                role: account.role,
                enabled: account.enabled,
              }),
              datosNuevos: JSON.stringify({
                role: rows[0].rol,
                enabled: rows[0].habilitada,
                actor,
              }),
            },
          ])
          .returning('id')
          .build(),
      );
      return this.map(rows[0]);
    });
  }
}
