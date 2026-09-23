import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  RuleStatus,
  RuleVersion,
  UsageRule,
} from '../../../domain/entities/usage-rule.js';
import {
  RuleRepository,
  type RuleVersionData,
} from '../../../domain/repositories/rule.repository.js';

@Injectable()
export class PrismaRuleRepository implements RuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(_data: RuleVersionData): Promise<UsageRule> {
    // TODO
    throw new Error('Not implemented');
  }

  async findById(_ruleId: string): Promise<UsageRule | null> {
    // TODO
    throw new Error('Not implemented');
  }

  async addVersion(
    _ruleId: string,
    _data: RuleVersionData,
  ): Promise<RuleVersion> {
    // TODO
    throw new Error('Not implemented');
  }

  async setStatus(_ruleId: string, _status: RuleStatus): Promise<RuleVersion> {
    // TODO
    throw new Error('Not implemented');
  }

  async findActiveVersions(): Promise<RuleVersion[]> {
    // TODO
    throw new Error('Not implemented');
  }
}
