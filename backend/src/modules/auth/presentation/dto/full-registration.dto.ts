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

  @ApiProperty({
    type: String,
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
    description: 'Elegida por todo solicitante. Solo se persiste su hash Argon2id; no se muestra ni envía al personal ni se incluye en auditorías. Tras aprobar se accede con el correo y esta contraseña originales.',
  })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiProperty({ type: String, enum: UserType, description: 'Tipo institucional; DOCENTE se presenta como Profesor. No determina el rol de acceso, que será USUARIO.' })
  @IsEnum(UserType)
  userType!: UserType;

  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  institutionalId?: string;

  @ApiPropertyOptional({ type: String, maxLength: 20 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(20)
  phone?: string;

  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: 1,
    description:
      'Una imagen PNG/JPEG de hasta 60 KiB o PDF de hasta 10 MiB como data URL base64. No texto ni URL externa. Estudiantes: carné o constancia de matrícula vigente. Profesores y administrativos: evidencia de vinculación institucional.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1)
  @IsString({ each: true })
  @MaxLength(14000000, { each: true })
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
