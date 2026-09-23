import { Injectable } from '@nestjs/common';
import type { RuleVersion } from '../../domain/entities/usage-rule.js';
import { RuleRepository } from '../../domain/repositories/rule.repository.js';

@Injectable()
export class ListActiveRulesUseCase {
  constructor(private readonly rules: RuleRepository) {}

  async execute(): Promise<RuleVersion[]> {
    // TODO
    throw new Error('Not implemented');
  }
}
