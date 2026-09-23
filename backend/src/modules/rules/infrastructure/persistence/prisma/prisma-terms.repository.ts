import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  TermsAcceptance,
  TermsVersion,
} from '../../../domain/entities/terms.js';
import {
  TermsRepository,
  type AcceptTermsVersionData,
  type CreateTermsVersionData,
} from '../../../domain/repositories/terms.repository.js';

@Injectable()
export class PrismaTermsRepository implements TermsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createVersion(_data: CreateTermsVersionData): Promise<TermsVersion> {
    // TODO
    throw new Error('Not implemented');
  }

  async findVersionById(_versionId: string): Promise<TermsVersion | null> {
    // TODO
    throw new Error('Not implemented');
  }

  async accept(_data: AcceptTermsVersionData): Promise<TermsAcceptance> {
    // TODO
    throw new Error('Not implemented');
  }

  async findAcceptancesByUserId(_userId: string): Promise<TermsAcceptance[]> {
    // TODO
    throw new Error('Not implemented');
  }
}
