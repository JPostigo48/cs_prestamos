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
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: String, format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: String, format: 'password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ enum: AccessRole })
  @IsOptional()
  @IsEnum(AccessRole)
  role?: AccessRole;
}
