import { Injectable } from '@nestjs/common';
import type { UpdateRuleInput } from '../ports/rules.inputs.js';
import type { RuleVersion } from '../../domain/entities/usage-rule.js';
import { RuleRepository } from '../../domain/repositories/rule.repository.js';

@Injectable()
export class UpdateRuleUseCase {
  constructor(private readonly rules: RuleRepository) {}

  async execute(_input: UpdateRuleInput): Promise<RuleVersion> {
    // TODO
    throw new Error('Not implemented');
  }
}
