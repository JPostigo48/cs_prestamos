import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AccessRole } from '../../domain/entities/access-account.js';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAccessAccountDto {
  @ApiPropertyOptional({ enum: AccessRole, nullable: true })
  @IsOptional()
  @IsEnum(AccessRole)
  role?: AccessRole;

  @ApiPropertyOptional({ type: Boolean, nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
