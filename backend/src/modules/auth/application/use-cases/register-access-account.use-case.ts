import { Injectable } from '@nestjs/common';
import type { RegisterAccessAccountInput } from '../ports/auth.inputs.js';
import { AuthUserPort } from '../ports/auth-user.port.js';
import { CredentialsPort } from '../ports/credentials.port.js';
import type { AccessAccount } from '../../domain/entities/access-account.js';
import { AccessAccountRepository } from '../../domain/repositories/access-account.repository.js';

@Injectable()
export class RegisterAccessAccountUseCase {
  constructor(
    private readonly accounts: AccessAccountRepository,
    private readonly users: AuthUserPort,
    private readonly credentials: CredentialsPort,
  ) {}

  async execute(_input: RegisterAccessAccountInput): Promise<AccessAccount> {
    // TODO
    throw new Error('Not implemented');
  }
}
