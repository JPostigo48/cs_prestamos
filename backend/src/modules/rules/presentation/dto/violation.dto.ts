import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import { AppealStatus } from '../../domain/entities/appeal.js';

export class RegisterViolationDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  ruleId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  occurredAt!: Date;
}

export class SubmitAppealDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: String, maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  reason!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  submittedAt!: Date;
}

export class ResolveAppealDto {
  @ApiProperty({ enum: [AppealStatus.ACCEPTED, AppealStatus.REJECTED] })
  @IsIn([AppealStatus.ACCEPTED, AppealStatus.REJECTED])
  status!: AppealStatus.ACCEPTED | AppealStatus.REJECTED;

  @ApiProperty({ type: String, maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  resolution!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  resolvedAt!: Date;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  resolvedByAccountId!: string;
}
