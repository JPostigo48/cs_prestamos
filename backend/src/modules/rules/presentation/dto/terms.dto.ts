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
  @ApiProperty({ type: Number, minimum: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  number!: number;

  @ApiPropertyOptional({ type: String, maxLength: 180, example: 'Términos de uso' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @ApiPropertyOptional({ type: String, example: 'Contenido de ejemplo de los términos' })
  @IsOptional()
  @IsString()
  content?: string;
}

export class AcceptTermsVersionDto {
  @ApiProperty({ type: String, format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: String, format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440004' })
  @IsUUID()
  termsVersionId!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2030-01-15T10:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  acceptedAt!: Date;
}
