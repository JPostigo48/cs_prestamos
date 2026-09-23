import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReturnLoanDto {
  @Type(() => Date)
  @IsDate()
  returnedAt!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observation?: string;
}
