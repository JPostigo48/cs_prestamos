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
  @IsUUID()
  userId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsEnum(AccessRole)
  role?: AccessRole;
}
