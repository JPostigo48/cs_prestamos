import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type { Appeal } from '../../../domain/entities/appeal.js';
import {
  AppealRepository,
  type ResolveAppealData,
  type SubmitAppealData,
} from '../../../domain/repositories/appeal.repository.js';

@Injectable()
export class PrismaAppealRepository implements AppealRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(_data: SubmitAppealData): Promise<Appeal> {
    // TODO
    throw new Error('Not implemented');
  }

  async findById(_appealId: string): Promise<Appeal | null> {
    // TODO
    throw new Error('Not implemented');
  }

  async findByViolationId(_violationId: string): Promise<Appeal | null> {
    // TODO
    throw new Error('Not implemented');
  }

  async resolve(_data: ResolveAppealData): Promise<Appeal> {
    // TODO
    throw new Error('Not implemented');
  }
}
