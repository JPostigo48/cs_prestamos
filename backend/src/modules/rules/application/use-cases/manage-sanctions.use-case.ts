import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';
import type { AuthenticatedIdentity } from '../../../auth/application/ports/auth.inputs.js';
import {
  SanctionRepository,
  type AppealsQuery,
  type SuspendUserData,
} from '../../domain/repositories/sanction.repository.js';

@Injectable()
export class ManageSanctionsUseCase {
  constructor(private readonly sanctions: SanctionRepository) {}

  listAppeals(query: AppealsQuery, identity: AuthenticatedIdentity) {
    if (identity.role === AccessRole.USER) {
      if (query.userId && query.userId !== identity.userId)
        throw new ForbiddenException('Solo puede consultar sus apelaciones.');
      query = { ...query, userId: identity.userId };
    }
    return this.sanctions.listAppeals(query);
  }

  async detail(id: string, identity: AuthenticatedIdentity) {
    const result = await this.sanctions.findDetail(id);
    if (!result) throw new NotFoundException('Sanción no encontrada.');
    if (identity.role === AccessRole.USER && result.userId !== identity.userId)
      throw new ForbiddenException('Solo puede consultar sus sanciones.');
    return result;
  }

  suspend(data: SuspendUserData) {
    if (!data.reason.trim())
      throw new BadRequestException('Debe fundamentar la suspensión.');
    return this.sanctions.suspend({ ...data, reason: data.reason.trim() });
  }

  lift(id: string, resolution: string, identity: AuthenticatedIdentity) {
    if (!resolution.trim())
      throw new BadRequestException('Debe fundamentar el levantamiento.');
    return this.sanctions.lift(id, resolution.trim(), identity);
  }
}
