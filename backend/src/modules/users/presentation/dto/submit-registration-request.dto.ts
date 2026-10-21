import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { UserType } from '../../domain/entities/registration-request.js';

export class SubmitRegistrationRequestDto {
  @ApiPropertyOptional({ type: String, minLength: 2, maxLength: 180 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2)
  @MaxLength(180)
  nombre?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiProperty({ enum: UserType, example: UserType.ESTUDIANTE })
  @IsOptional()
  @IsEnum(UserType)
  userType!: UserType;

  @ApiPropertyOptional({ type: String, maxLength: 80, example: '20260001' })
  @IsOptional()
  @IsEnum(UserType)
  tipoUsuario?: UserType;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(80)
  institutionalId?: string;

  @ApiPropertyOptional({ type: [String], example: ['Referencia de evidencia'] })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(80)
  identificadorInstitucional?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidencias?: string[];
}
