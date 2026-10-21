import { Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  AuthenticateAccountInput,
  AuthenticatedIdentity,
} from '../ports/auth.inputs.js';
import { AuthUserPort } from '../ports/auth-user.port.js';
import { CredentialsPort } from '../ports/credentials.port.js';
import { AccessAccountRepository } from '../../domain/repositories/access-account.repository.js';
import { InstitutionalEmailPolicy } from '../../domain/policies/institutional-email.policy.js';

@Injectable()
export class AuthenticateAccountUseCase {
  constructor(
    private readonly accounts: AccessAccountRepository,
    private readonly users: AuthUserPort,
    private readonly credentials: CredentialsPort,
  ) {}

  async execute(
    input: AuthenticateAccountInput,
  ): Promise<AuthenticatedIdentity> {
    const email = InstitutionalEmailPolicy.assertValid(input.email);
    const account = await this.accounts.findByEmail(email);
    const invalid = () =>
      new UnauthorizedException('Credenciales inválidas.');

    if (!account || !account.enabled) throw invalid();
    const validPassword = await this.credentials.matches(
      input.password,
      account.passwordHash,
    );
    if (!validPassword) throw invalid();

    const user = await this.users.getById(account.userId);
    if (!user.currentAffiliation) throw invalid();
    await this.accounts.recordAccess(account.id, new Date());

    return {
      accountId: account.id,
      userId: account.userId,
      userType: user.userType,
      role: account.role,
    };
  }
}
