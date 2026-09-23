import { Injectable } from '@nestjs/common';
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

  async execute(_input: RegisterViolationInput): Promise<Violation> {
    // TODO
    throw new Error('Not implemented');
  }
}
