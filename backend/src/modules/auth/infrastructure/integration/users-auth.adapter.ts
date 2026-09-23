import { Injectable } from '@nestjs/common';
import {
  AuthUserPort,
  type AuthUser,
} from '../../application/ports/auth-user.port.js';
import { GetUserUseCase } from '../../../users/application/use-cases/get-user.use-case.js';

@Injectable()
export class UsersAuthAdapter implements AuthUserPort {
  constructor(private readonly getUser: GetUserUseCase) {}

  async getById(userId: string): Promise<AuthUser> {
    const user = await this.getUser.execute({ userId });

    return {
      userId: user.id,
      userType: user.userType,
      currentAffiliation: user.hasCurrentAffiliation,
    };
  }
}
