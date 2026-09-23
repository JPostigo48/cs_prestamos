import { Injectable } from '@nestjs/common';
import type { CreateRuleInput } from '../ports/rules.inputs.js';
import type { UsageRule } from '../../domain/entities/usage-rule.js';
import { RuleRepository } from '../../domain/repositories/rule.repository.js';

@Injectable()
export class CreateRuleUseCase {
  constructor(private readonly rules: RuleRepository) {}

  async execute(_input: CreateRuleInput): Promise<UsageRule> {
    // TODO
    throw new Error('Not implemented');
  }
}
