import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { UserType } from '../../../users/domain/entities/registration-request.js';

export class FullRegistrationDto {
  @ApiProperty({ type: String, minLength: 2, maxLength: 180 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 180)
  name!: string;

  @ApiProperty({
    type: String,
    format: 'email',
    maxLength: 254,
    description: 'Correo institucional @unsa.edu.pe.',
  })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ type: String, minLength: 8, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiProperty({ type: String, enum: UserType })
  @IsEnum(UserType)
  userType!: UserType;

  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  institutionalId?: string;

  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: 1,
    description:
      'Una imagen PNG/JPEG como data URL base64, máximo 60 KiB binarios; no texto ni URL externa.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1)
  @IsString({ each: true })
  @MaxLength(82000, { each: true })
  evidence!: string[];

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Versión vigente leída y aceptada expresamente.',
  })
  @IsUUID()
  termsVersionId!: string;
}

export class PendingRegistrationResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, enum: ['PENDIENTE'] }) status!: 'PENDIENTE';
}
