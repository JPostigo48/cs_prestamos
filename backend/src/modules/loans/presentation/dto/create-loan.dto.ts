import { Type } from 'class-transformer';
import { IsDate, IsUUID } from 'class-validator';

export class CreateLoanDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  copyId!: string;

  @Type(() => Date)
  @IsDate()
  startsAt!: Date;
}
