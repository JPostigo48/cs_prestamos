import { Type } from 'class-transformer';
import { IsDate, IsUUID } from 'class-validator';

export class CreateLoanDto {
  @IsUUID()
  copyId!: string;

  @Type(() => Date)
  @IsDate()
  startsAt!: Date;
}
