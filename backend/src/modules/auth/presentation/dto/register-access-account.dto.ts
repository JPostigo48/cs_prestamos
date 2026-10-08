import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { AccessRole } from '../../domain/entities/access-account.js';

export class RegisterAccessAccountDto {
  @ApiProperty({ type: String, format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: String, format: 'email', example: 'usuario@ejemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: String, format: 'password', minLength: 8, example: 'ClaveEjemplo123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ enum: AccessRole, example: AccessRole.USER })
  @IsOptional()
  @IsEnum(AccessRole)
  role?: AccessRole;
}
