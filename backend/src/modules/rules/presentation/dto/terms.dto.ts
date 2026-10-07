import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTermsVersionDto {
  @ApiProperty({ type: Number, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  number!: number;

  @ApiPropertyOptional({ type: String, maxLength: 180 })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  content?: string;
}

export class AcceptTermsVersionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  termsVersionId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  acceptedAt!: Date;
}
