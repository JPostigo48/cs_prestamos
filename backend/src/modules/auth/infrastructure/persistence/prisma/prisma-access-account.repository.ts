import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type { AccessAccount } from '../../../domain/entities/access-account.js';
import {
  AccessAccountRepository,
  type CreateAccessAccountData,
} from '../../../domain/repositories/access-account.repository.js';

@Injectable()
export class PrismaAccessAccountRepository implements AccessAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(_data: CreateAccessAccountData): Promise<AccessAccount> {
    // TODO
    throw new Error('Not implemented');
  }

  async findById(_accountId: string): Promise<AccessAccount | null> {
    // TODO
    throw new Error('Not implemented');
  }

  async findByEmail(_email: string): Promise<AccessAccount | null> {
    // TODO
    throw new Error('Not implemented');
  }

  async findByUserId(_userId: string): Promise<AccessAccount | null> {
    // TODO
    throw new Error('Not implemented');
  }

  async recordAccess(_accountId: string, _accessedAt: Date): Promise<void> {
    // TODO
    throw new Error('Not implemented');
  }
}
