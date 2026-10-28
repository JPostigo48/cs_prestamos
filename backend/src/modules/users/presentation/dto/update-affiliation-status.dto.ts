import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAffiliationStatusDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  vinculacionVigente!: boolean;
}
