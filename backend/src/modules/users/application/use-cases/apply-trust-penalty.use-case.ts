import { Injectable } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import type { ApplyTrustPenaltyInput } from '../ports/users.inputs.js';
import type { UserTrustProfile } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';

@Injectable()
export class ApplyTrustPenaltyUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: ApplyTrustPenaltyInput): Promise<UserTrustProfile> {
    if (input.penaltyPercentage <= 0 || input.penaltyPercentage > 100) {
      throw new BadRequestException('penaltyPercentage debe estar entre 0 y 100.');
    }
    return this.users.applyTrustPenalty({
      userId: input.userId,
      violationId: input.violationId,
      ruleId: input.ruleId,
      ruleVersionId: input.ruleVersionId,
      penaltyPercentage: input.penaltyPercentage,
    });
  }
}
