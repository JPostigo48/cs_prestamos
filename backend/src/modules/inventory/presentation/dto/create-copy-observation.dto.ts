import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCopyObservationDto {
  @ApiProperty({ type: String, maxLength: 2000, example: 'Carcasa con desgaste superficial' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(2000)
  descripcion!: string;
}
