import { Injectable, NotFoundException } from '@nestjs/common';
import type { RegisterViolationInput } from '../ports/violations.inputs.js';
import { UserTrustPort } from '../ports/user-trust.port.js';
import type { Violation } from '../../domain/entities/violation.js';
import { RuleRepository } from '../../domain/repositories/rule.repository.js';
import { ViolationRepository } from '../../domain/repositories/violation.repository.js';

@Injectable()
export class RegisterViolationUseCase {
  constructor(
    private readonly violations: ViolationRepository,
    private readonly rules: RuleRepository,
    private readonly users: UserTrustPort,
  ) {}

  async execute(input: RegisterViolationInput): Promise<Violation> {
    const rule = await this.rules.findById(input.ruleId);
    const version = rule?.versions.find((item) => item.id === rule.currentVersionId);
    if (!rule || !version || version.status !== 'ACTIVA') {
      throw new NotFoundException('Regla activa no encontrada.');
    }
    const violation = await this.violations.create({
      userId: input.userId,
      ruleId: input.ruleId,
      ruleVersionId: version.id,
      occurredAt: input.occurredAt,
      appliedPenalty: version.penaltyPercentage,
    });
    await this.users.applyPenalty({
      userId: input.userId, violationId: violation.id, ruleId: input.ruleId,
      ruleVersionId: version.id, penaltyPercentage: version.penaltyPercentage,
    });
    return violation;
  }
}
