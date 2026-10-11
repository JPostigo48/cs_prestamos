import { Injectable } from '@nestjs/common';
import type { UpdateRuleInput } from '../ports/rules.inputs.js';
import type { RuleVersion } from '../../domain/entities/usage-rule.js';
import { RuleRepository } from '../../domain/repositories/rule.repository.js';

@Injectable()
export class UpdateRuleUseCase {
  constructor(private readonly rules: RuleRepository) {}

  async execute(input: UpdateRuleInput): Promise<RuleVersion> {
    const { ruleId, ...data } = input;
    return this.rules.addVersion(ruleId, data);
  }
}
