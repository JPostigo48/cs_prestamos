import { Injectable } from '@nestjs/common';
import {
  UserTrustPort,
  type ApplyRulePenaltyInput,
} from '../../application/ports/user-trust.port.js';
import { ApplyTrustPenaltyUseCase } from '../../../users/application/use-cases/apply-trust-penalty.use-case.js';

@Injectable()
export class UsersTrustAdapter implements UserTrustPort {
  constructor(private readonly applyTrustPenalty: ApplyTrustPenaltyUseCase) {}

  async applyPenalty(input: ApplyRulePenaltyInput): Promise<void> {
    await this.applyTrustPenalty.execute(input);
  }
}
