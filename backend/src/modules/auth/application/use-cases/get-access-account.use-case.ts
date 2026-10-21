import { Injectable, NotFoundException } from '@nestjs/common';
import type { GetAccessAccountInput } from '../ports/auth.inputs.js';
import type { AccessAccount } from '../../domain/entities/access-account.js';
import { AccessAccountRepository } from '../../domain/repositories/access-account.repository.js';

@Injectable()
export class GetAccessAccountUseCase {
  constructor(private readonly accounts: AccessAccountRepository) {}

  async execute(input: GetAccessAccountInput): Promise<AccessAccount> {
    const account = await this.accounts.findById(input.accountId);
    if (!account) throw new NotFoundException('Cuenta no encontrada.');
    return account;
  }
}
