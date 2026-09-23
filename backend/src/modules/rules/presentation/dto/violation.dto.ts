import { Type } from 'class-transformer';
import { IsDate, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import { AppealStatus } from '../../domain/entities/appeal.js';

export class RegisterViolationDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  ruleId!: string;

  @Type(() => Date)
  @IsDate()
  occurredAt!: Date;
}

export class SubmitAppealDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MaxLength(2000)
  reason!: string;

  @Type(() => Date)
  @IsDate()
  submittedAt!: Date;
}

export class ResolveAppealDto {
  @IsIn([AppealStatus.ACCEPTED, AppealStatus.REJECTED])
  status!: AppealStatus.ACCEPTED | AppealStatus.REJECTED;

  @IsString()
  @MaxLength(2000)
  resolution!: string;

  @Type(() => Date)
  @IsDate()
  resolvedAt!: Date;

  @IsUUID()
  resolvedByAccountId!: string;
}
