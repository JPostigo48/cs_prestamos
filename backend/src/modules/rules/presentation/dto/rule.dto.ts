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
  @ApiProperty({ type: String, maxLength: 180 })
  @IsString()
  @MaxLength(180)
  title!: string;

  @ApiProperty({ type: String })
  @IsString()
  description!: string;

  @ApiProperty({ type: Number, minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  penaltyPercentage!: number;

  @ApiProperty({ type: String })
  @IsString()
  consequence!: string;
}

export class UpdateRuleDto extends CreateRuleDto {}

export class SetRuleStatusDto {
  @ApiProperty({ enum: RuleStatus })
  @IsEnum(RuleStatus)
  status!: RuleStatus;
}
