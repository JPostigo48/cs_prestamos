import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UserType } from '../../domain/entities/registration-request.js';

export class SubmitRegistrationRequestDto {
  @ApiProperty({ enum: UserType, example: UserType.ESTUDIANTE })
  @IsEnum(UserType)
  userType!: UserType;

  @ApiPropertyOptional({ type: String, maxLength: 80, example: '20260001' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(80)
  institutionalId?: string;

  @ApiPropertyOptional({ type: [String], example: ['Referencia de evidencia'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];
}
