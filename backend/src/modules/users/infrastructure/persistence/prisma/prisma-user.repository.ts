import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  LoanEligibility,
  Sanction,
  User,
  UserTrustProfile,
} from '../../../domain/entities/user.js';
import {
  UserRepository,
  type ApplyTrustPenaltyData,
} from '../../../domain/repositories/user.repository.js';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(_user: User): Promise<User> {
    // TODO
    throw new Error('Not implemented');
  }

  async findById(_userId: string): Promise<User | null> {
    // TODO
    throw new Error('Not implemented');
  }

  async getLoanEligibility(_userId: string): Promise<LoanEligibility> {
    // TODO
    throw new Error('Not implemented');
  }

  async getTrustProfile(_userId: string): Promise<UserTrustProfile> {
    // TODO
    throw new Error('Not implemented');
  }

  async applyTrustPenalty(
    _data: ApplyTrustPenaltyData,
  ): Promise<UserTrustProfile> {
    // TODO
    throw new Error('Not implemented');
  }

  async listSanctions(_userId: string): Promise<Sanction[]> {
    // TODO
    throw new Error('Not implemented');
  }
}
