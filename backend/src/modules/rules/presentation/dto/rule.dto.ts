import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RuleStatus } from '../../domain/entities/usage-rule.js';

export class CreateRuleDto {
  @ApiProperty({ type: String, maxLength: 180, example: 'Regla de uso de ejemplo' })
  @IsString()
  @MaxLength(180)
  title!: string;

  @ApiProperty({ type: String, example: 'Descripción de la regla de uso' })
  @IsString()
  description!: string;

  @ApiProperty({ type: Number, minimum: 0, maximum: 100, example: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  penaltyPercentage!: number;

  @ApiProperty({ type: String, example: 'Consecuencia definida para esta regla' })
  @IsString()
  consequence!: string;
}

export class UpdateRuleDto extends CreateRuleDto {}

export class SetRuleStatusDto {
  @ApiProperty({ enum: RuleStatus, example: RuleStatus.ACTIVE })
  @IsEnum(RuleStatus)
  status!: RuleStatus;
}
