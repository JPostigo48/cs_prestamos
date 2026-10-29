import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessAccount } from '../../domain/entities/access-account.js';
import { AccessAccountRepository } from '../../domain/repositories/access-account.repository.js';
import type { UpdateAccessAccountInput } from '../ports/auth.inputs.js';
import type { AuditActor } from '../../../../shared/application/audit-actor.js';

@Injectable()
export class UpdateAccessAccountUseCase {
  constructor(private readonly accounts: AccessAccountRepository) {}

  async execute(
    input: UpdateAccessAccountInput,
    actor?: AuditActor,
  ): Promise<AccessAccount> {
    if (input.role === undefined && input.enabled === undefined) {
      throw new BadRequestException(
        'Debe especificar el rol o el estado de la cuenta.',
      );
    }
    const account = await this.accounts.findById(input.accountId);
    if (!account) throw new NotFoundException('Cuenta no encontrada.');
    const data = {
      role: input.role,
      enabled: input.enabled,
    };
    return actor
      ? this.accounts.update(input.accountId, data, actor)
      : this.accounts.update(input.accountId, data);
  }
}
