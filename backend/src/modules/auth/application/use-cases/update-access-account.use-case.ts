import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessAccount } from '../../domain/entities/access-account.js';
import { AccessAccountRepository } from '../../domain/repositories/access-account.repository.js';
import type { UpdateAccessAccountInput } from '../ports/auth.inputs.js';

@Injectable()
export class UpdateAccessAccountUseCase {
  constructor(private readonly accounts: AccessAccountRepository) {}

  async execute(input: UpdateAccessAccountInput): Promise<AccessAccount> {
    if (input.role === undefined && input.enabled === undefined) {
      throw new BadRequestException(
        'Debe especificar el rol o el estado de la cuenta.',
      );
    }
    const account = await this.accounts.findById(input.accountId);
    if (!account) throw new NotFoundException('Cuenta no encontrada.');
    return this.accounts.update(input.accountId, {
      role: input.role,
      enabled: input.enabled,
    });
  }
}
