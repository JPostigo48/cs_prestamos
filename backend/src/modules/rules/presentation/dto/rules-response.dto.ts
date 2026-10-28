import { ApiProperty } from '@nestjs/swagger';
import {
  RuleStatus,
  SuspensionType,
} from '../../domain/entities/usage-rule.js';
import { AppealStatus } from '../../domain/entities/appeal.js';

export class RuleVersionResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) ruleId!: string;
  @ApiProperty({ type: 'integer' }) number!: number;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: Number }) penaltyPercentage!: number;
  @ApiProperty({ type: String }) consequence!: string;
  @ApiProperty({ enum: SuspensionType, nullable: true })
  suspensionType!: SuspensionType | null;
  @ApiProperty({ type: 'integer', nullable: true }) suspensionDays!:
    number | null;
  @ApiProperty({ enum: RuleStatus }) status!: RuleStatus;
}

export class UsageRuleResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  currentVersionId!: string | null;
  @ApiProperty({ type: [RuleVersionResponseDto] })
  versions!: RuleVersionResponseDto[];
}

export class TermsVersionResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: 'integer' }) number!: number;
  @ApiProperty({ type: String, nullable: true }) title!: string | null;
  @ApiProperty({ type: String, nullable: true }) content!: string | null;
}

export class TermsAcceptanceResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) userId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) termsVersionId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) acceptedAt!: string;
}

export class ViolationResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) userId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) ruleId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) ruleVersionId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ type: Number }) appliedPenalty!: number;
}

export class AppealResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) violationId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) sanctionId!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid' }) userId!: string;
  @ApiProperty({ type: String }) reason!: string;
  @ApiProperty({ type: String, format: 'date-time' }) submittedAt!: string;
  @ApiProperty({ enum: AppealStatus }) status!: AppealStatus;
  @ApiProperty({ type: String, nullable: true }) resolution!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  resolvedByAccountId!: string | null;
}
