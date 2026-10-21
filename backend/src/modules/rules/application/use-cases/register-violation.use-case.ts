import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RegisterViolationInput } from '../ports/violations.inputs.js';
import type { Violation } from '../../domain/entities/violation.js';
import { RuleRepository } from '../../domain/repositories/rule.repository.js';
import { ViolationRepository } from '../../domain/repositories/violation.repository.js';

@Injectable()
export class RegisterViolationUseCase {
  constructor(
    private readonly violations: ViolationRepository,
    private readonly rules: RuleRepository,
  ) {}

  async execute(input: RegisterViolationInput): Promise<Violation> {
    const rule = await this.rules.findById(input.ruleId);
    const version = rule?.versions.find((item) => item.id === rule.currentVersionId);
    if (!rule || !version || version.status !== 'ACTIVA') {
      throw new NotFoundException('Regla activa no encontrada.');
    }
    if (version.penaltyPercentage <= 0 || version.penaltyPercentage > 100) {
      throw new BadRequestException('La penalización debe estar entre 0 y 100.');
    }
    if (!version.suspensionType) {
      throw new ConflictException('La versión de la regla no tiene una política de suspensión configurada.');
    }
    return this.violations.createWithPenalty({
      userId: input.userId,
      ruleId: input.ruleId,
      ruleVersionId: version.id,
      occurredAt: input.occurredAt,
      configuredPenalty: version.penaltyPercentage,
      suspensionType: version.suspensionType,
      suspensionDays: version.suspensionDays,
    });
  }
}
