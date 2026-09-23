import { Injectable } from '@nestjs/common';
import type { GetAccessAccountInput } from '../ports/auth.inputs.js';
import type { AccessAccount } from '../../domain/entities/access-account.js';
import { AccessAccountRepository } from '../../domain/repositories/access-account.repository.js';

@Injectable()
export class GetAccessAccountUseCase {
  constructor(private readonly accounts: AccessAccountRepository) {}

  async execute(_input: GetAccessAccountInput): Promise<AccessAccount> {
    // TODO
    throw new Error('Not implemented');
  }
}
