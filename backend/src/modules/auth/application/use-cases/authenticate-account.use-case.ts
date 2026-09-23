import { Injectable } from '@nestjs/common';
import type {
  AuthenticateAccountInput,
  AuthenticatedIdentity,
} from '../ports/auth.inputs.js';
import { AuthUserPort } from '../ports/auth-user.port.js';
import { CredentialsPort } from '../ports/credentials.port.js';
import { AccessAccountRepository } from '../../domain/repositories/access-account.repository.js';

@Injectable()
export class AuthenticateAccountUseCase {
  constructor(
    private readonly accounts: AccessAccountRepository,
    private readonly users: AuthUserPort,
    private readonly credentials: CredentialsPort,
  ) {}

  async execute(
    _input: AuthenticateAccountInput,
  ): Promise<AuthenticatedIdentity> {
    // TODO
    throw new Error('Not implemented');
  }
}
