import { Injectable } from '@nestjs/common';
import type { ListUsersInput } from '../ports/users.inputs.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class ListUsersUseCase {
  constructor(private readonly users: UserRepository) {}

  execute(input: ListUsersInput) {
    return this.users.list({
      userType: input.userType,
      hasCurrentAffiliation: input.hasCurrentAffiliation,
      institutionalId: input.institutionalId?.trim(),
      page: Math.max(1, Number(input.page) || 1),
      limit: Math.min(100, Math.max(1, Number(input.limit) || 20)),
    });
  }
}
