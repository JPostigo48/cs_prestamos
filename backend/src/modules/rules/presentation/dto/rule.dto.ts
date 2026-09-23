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
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  penaltyPercentage!: number;

  @IsString()
  consequence!: string;
}

export class UpdateRuleDto extends CreateRuleDto {}

export class SetRuleStatusDto {
  @IsEnum(RuleStatus)
  status!: RuleStatus;
}
