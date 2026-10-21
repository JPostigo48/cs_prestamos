import { Injectable } from '@nestjs/common';
import type { SetRuleStatusInput } from '../ports/rules.inputs.js';
import type { RuleVersion } from '../../domain/entities/usage-rule.js';
import { RuleRepository } from '../../domain/repositories/rule.repository.js';

@Injectable()
export class SetRuleStatusUseCase {
  constructor(private readonly rules: RuleRepository) {}

  async execute(input: SetRuleStatusInput): Promise<RuleVersion> {
    return this.rules.setStatus(input.ruleId, input.status);
  }
}
