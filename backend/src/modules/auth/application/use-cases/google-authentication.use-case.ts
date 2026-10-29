import { Injectable, UnauthorizedException } from '@nestjs/common';
import { GoogleIdentityPort } from '../ports/google-identity.port.js';
import { AuthUserPort } from '../ports/auth-user.port.js';
import { AccessAccountRepository } from '../../domain/repositories/access-account.repository.js';

@Injectable()
export class GoogleAuthenticationUseCase {
  constructor(
    private readonly google: GoogleIdentityPort,
    private readonly accounts: AccessAccountRepository,
    private readonly users: AuthUserPort,
  ) {}

  async execute(code: string, state: string, browserToken: string) {
    const verified = await this.google.exchange(code, state, browserToken);
    // No autoalta ni roles por claims Google: solo cuentas institucionales previamente aprobadas.
    const account = await this.accounts.findByEmail(verified.email);
    if (!account || !account.enabled)
      throw new UnauthorizedException(
        'No existe una cuenta habilitada y aprobada para este correo.',
      );
    const user = await this.users.getById(account.userId);
    if (!user.currentAffiliation)
      throw new UnauthorizedException(
        'La vinculación institucional no está vigente.',
      );
    await this.accounts.recordAccess(account.id, new Date());
    return {
      identity: {
        accountId: account.id,
        userId: user.userId,
        userType: user.userType,
        role: account.role,
      },
      email: account.email,
    };
  }
}
