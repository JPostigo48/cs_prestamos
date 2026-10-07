import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsUUID } from 'class-validator';

export class CreateLoanDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  copyId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;
}
