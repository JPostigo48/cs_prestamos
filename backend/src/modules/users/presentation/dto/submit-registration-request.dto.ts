import { ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({
    type: String,
    minLength: 2,
    maxLength: 180,
    description:
      'Nombre preferido sobre el alias nombre; uno de ambos debe contener al menos 2 caracteres.',
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({
    enum: UserType,
    example: UserType.ESTUDIANTE,
    description:
      'Tipo preferido sobre tipoUsuario; debe proporcionarse uno de ambos.',
  })
  @IsOptional()
  @IsEnum(UserType)
  userType!: UserType;

  @ApiPropertyOptional({ enum: UserType })
  @IsOptional()
  @IsEnum(UserType)
  tipoUsuario?: UserType;

  @ApiPropertyOptional({ type: String, maxLength: 80, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(80)
  institutionalId?: string;

  @ApiPropertyOptional({ type: String, maxLength: 80, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(80)
  identificadorInstitucional?: string;

  @ApiPropertyOptional({ type: [String], nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];

  @ApiPropertyOptional({ type: [String], nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidencias?: string[];
}
