import { IsBoolean, IsEnum, ValidateIf } from 'class-validator';
import { AccessRole } from '../../domain/entities/access-account.js';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAccessAccountDto {
  @ApiPropertyOptional({ enum: AccessRole })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(AccessRole)
  role?: AccessRole;

  @ApiPropertyOptional({ type: Boolean })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  enabled?: boolean;
}
