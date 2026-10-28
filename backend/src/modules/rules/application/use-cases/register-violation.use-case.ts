import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RegisterViolationInput } from '../ports/violations.inputs.js';
import type { Violation } from '../../domain/entities/violation.js';
import { RuleRepository } from '../../domain/repositories/rule.repository.js';
import { ViolationRepository } from '../../domain/repositories/violation.repository.js';
import { readOfficialPolicyEffect } from '../../domain/official-policy.catalog.js';
import { SuspensionType } from '../../domain/entities/usage-rule.js';

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
    const policy = readOfficialPolicyEffect(version.description);
    if (policy && (policy.trustEffect === 'NONE' || ['REWARD', 'ACCESS', 'TRUST'].includes(policy.kind))) {
      throw new BadRequestException('La configuración de acceso o recompensa no es una falta sancionable.');
    }
    if (policy?.kind === 'LATENESS' || policy?.kind === 'NO_SHOW') {
      throw new ConflictException('La política automática requiere contexto de préstamo/reserva; este registro manual no permite aplicarla.');
    }
    if (policy?.trustEffect === 'SET_ZERO' && (version.penaltyPercentage !== 0 ||
      version.suspensionType !== SuspensionType.INDEFINITE || version.suspensionDays !== null)) {
      throw new ConflictException('Establecer confianza en cero requiere efecto explícito y bloqueo indefinido, sin descuento nominal.');
    }
    if (policy?.trustEffect !== 'SET_ZERO' && (version.penaltyPercentage <= 0 || version.penaltyPercentage > 100)) {
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
      ...(policy ? { trustEffect: policy.trustEffect as 'DISCOUNT' | 'SET_ZERO' } : {}),
      suspensionType: version.suspensionType,
      suspensionDays: version.suspensionDays,
    });
  }
}
