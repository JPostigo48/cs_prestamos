import { IsBoolean } from 'class-validator';

export class UpdateAffiliationStatusDto {
  @IsBoolean()
  vinculacionVigente!: boolean;
}