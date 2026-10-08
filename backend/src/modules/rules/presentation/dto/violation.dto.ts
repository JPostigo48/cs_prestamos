import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import { AppealStatus } from '../../domain/entities/appeal.js';

export class RegisterViolationDto {
  @ApiProperty({ type: String, format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: String, format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440005' })
  @IsUUID()
  ruleId!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-09-01T10:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  occurredAt!: Date;
}

export class SubmitAppealDto {
  @ApiProperty({ type: String, format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: String, maxLength: 2000, example: 'Solicito revisar la sanción registrada' })
  @IsString()
  @MaxLength(2000)
  reason!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-09-02T10:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  submittedAt!: Date;
}

export class ResolveAppealDto {
  @ApiProperty({ enum: [AppealStatus.ACCEPTED, AppealStatus.REJECTED], example: AppealStatus.ACCEPTED })
  @IsIn([AppealStatus.ACCEPTED, AppealStatus.REJECTED])
  status!: AppealStatus.ACCEPTED | AppealStatus.REJECTED;

  @ApiProperty({ type: String, maxLength: 2000, example: 'Resultado de la revisión de la apelación' })
  @IsString()
  @MaxLength(2000)
  resolution!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-09-03T10:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  resolvedAt!: Date;

  @ApiProperty({ type: String, format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440006' })
  @IsUUID()
  resolvedByAccountId!: string;
}
