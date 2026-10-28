import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { AuditActor } from '../../../../shared/application/audit-actor.js';
import { UserType } from '../../domain/entities/registration-request.js';
import {
  UserRepository,
  type ManagedUserData,
} from '../../domain/repositories/user.repository.js';

@Injectable()
export class ManageUsersUseCase {
  constructor(private readonly users: UserRepository) {}

  private normalize(data: Partial<ManagedUserData>): Partial<ManagedUserData> {
    const result = { ...data };
    if (data.name !== undefined) {
      if (
        typeof data.name !== 'string' ||
        data.name.trim().length < 2 ||
        data.name.trim().length > 180
      )
        throw new BadRequestException('Nombre inválido.');
      result.name = data.name.trim();
    }
    if (
      data.userType !== undefined &&
      !Object.values(UserType).includes(data.userType)
    )
      throw new BadRequestException('Tipo de usuario inválido.');
    if (data.institutionalId !== undefined && data.institutionalId !== null) {
      if (
        typeof data.institutionalId !== 'string' ||
        !data.institutionalId.trim() ||
        data.institutionalId.trim().length > 80
      )
        throw new BadRequestException('Identificador institucional inválido.');
      result.institutionalId = data.institutionalId.trim();
    }
    if (
      data.hasCurrentAffiliation !== undefined &&
      typeof data.hasCurrentAffiliation !== 'boolean'
    )
      throw new BadRequestException('Vinculación inválida.');
    return result;
  }

  private async conflict<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const value = error as { code?: string; cause?: { code?: string } };
      if (value?.code === '23505' || value?.cause?.code === '23505')
        throw new ConflictException(
          'El identificador institucional ya está registrado.',
        );
      throw error;
    }
  }

  create(
    data: {
      name: string;
      userType: UserType;
      institutionalId?: string | null;
      hasCurrentAffiliation?: boolean;
    },
    actor: AuditActor,
  ) {
    const normalized = this.normalize(data);
    if (!normalized.name || !normalized.userType)
      throw new BadRequestException('Nombre y tipo de usuario obligatorios.');
    return this.conflict(() =>
      this.users.createManaged(
        {
          name: normalized.name!,
          userType: normalized.userType!,
          institutionalId: normalized.institutionalId ?? null,
          hasCurrentAffiliation: normalized.hasCurrentAffiliation ?? true,
        },
        actor,
      ),
    );
  }

  update(userId: string, data: Partial<ManagedUserData>, actor: AuditActor) {
    const normalized = this.normalize(data);
    if (!Object.values(normalized).some((value) => value !== undefined))
      throw new BadRequestException('Debe enviar al menos un campo.');
    return this.conflict(() =>
      this.users.updateManaged(userId, normalized, actor),
    );
  }

  deactivate(userId: string, actor: AuditActor) {
    return this.users.updateManaged(
      userId,
      { hasCurrentAffiliation: false },
      actor,
      'USUARIO_DESACTIVADO',
    );
  }
}
