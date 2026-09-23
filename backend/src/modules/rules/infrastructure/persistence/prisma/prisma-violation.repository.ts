import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type { Violation } from '../../../domain/entities/violation.js';
import {
  ViolationRepository,
  type RegisterViolationData,
} from '../../../domain/repositories/violation.repository.js';

@Injectable()
export class PrismaViolationRepository implements ViolationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(_data: RegisterViolationData): Promise<Violation> {
    // TODO
    throw new Error('Not implemented');
  }

  async findById(_violationId: string): Promise<Violation | null> {
    // TODO
    throw new Error('Not implemented');
  }
}
