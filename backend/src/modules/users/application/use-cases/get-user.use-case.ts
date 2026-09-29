import { Injectable } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import type { GetUserInput } from '../ports/users.inputs.js';
import type { User } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class GetUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: GetUserInput): Promise<User> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return user;
  }
}
