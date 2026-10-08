import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsUUID } from 'class-validator';

export class CreateLoanDto {
  @ApiProperty({ type: String, format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  copyId!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2030-01-15T10:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;
}
