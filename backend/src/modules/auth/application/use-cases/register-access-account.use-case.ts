import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RegisterAccessAccountInput } from '../ports/auth.inputs.js';
import { AuthUserPort } from '../ports/auth-user.port.js';
import { CredentialsPort } from '../ports/credentials.port.js';
import type { AccessAccount } from '../../domain/entities/access-account.js';
import { AccessAccountRepository } from '../../domain/repositories/access-account.repository.js';
import { AccessRole } from '../../domain/entities/access-account.js';
import { InstitutionalEmailPolicy } from '../../domain/policies/institutional-email.policy.js';

@Injectable()
export class RegisterAccessAccountUseCase {
  constructor(
    private readonly accounts: AccessAccountRepository,
    private readonly users: AuthUserPort,
    private readonly credentials: CredentialsPort,
  ) {}

  async execute(input: RegisterAccessAccountInput): Promise<AccessAccount> {
    const email = InstitutionalEmailPolicy.assertValid(input.email);
    if (input.role && input.role !== AccessRole.USER) {
      throw new ForbiddenException(
        'El autorregistro solo permite el rol USUARIO.',
      );
    }

    const user = await this.users.getById(input.userId);
    if (!user.currentAffiliation) {
      throw new ForbiddenException('El usuario no tiene vinculación vigente.');
    }
    if (await this.accounts.findByUserId(input.userId)) {
      throw new ConflictException('El usuario ya tiene una cuenta de acceso.');
    }
    if (await this.accounts.findByEmail(email)) {
      throw new ConflictException('El correo ya está en uso.');
    }

    return this.accounts.create({
      userId: input.userId,
      email,
      passwordHash: await this.credentials.hash(input.password),
      role: AccessRole.USER,
    });
  }
}
