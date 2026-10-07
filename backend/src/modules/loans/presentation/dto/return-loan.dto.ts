import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReturnLoanDto {
  @ApiProperty({ type: String, format: 'date-time', example: '2030-01-20T10:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  returnedAt!: Date;

  @ApiPropertyOptional({ type: String, maxLength: 1000, example: 'Devolución sin observaciones' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observation?: string;
}
