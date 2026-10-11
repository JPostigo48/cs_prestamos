import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AccessRole } from '../../domain/entities/access-account.js';

export class UpdateAccessAccountDto {
  @IsOptional()
  @IsEnum(AccessRole)
  role?: AccessRole;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
