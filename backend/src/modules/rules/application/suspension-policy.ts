import { BadRequestException } from '@nestjs/common';
import { SuspensionType } from '../domain/entities/usage-rule.js';
import type { RuleVersionData } from '../domain/repositories/rule.repository.js';

export function validateSuspensionPolicy(data: RuleVersionData): RuleVersionData {
  const days = data.suspensionDays;
  switch (data.suspensionType) {
    case SuspensionType.NONE:
      if (days !== undefined && days !== null && days !== 0) break;
      return { ...data, suspensionDays: null };
    case SuspensionType.TEMPORARY:
      if (Number.isInteger(days) && days! > 0) return data;
      break;
    case SuspensionType.INDEFINITE:
      if (days !== undefined && days !== null) break;
      return { ...data, suspensionDays: null };
  }
  throw new BadRequestException('La duración no corresponde al tipo de suspensión.');
}
