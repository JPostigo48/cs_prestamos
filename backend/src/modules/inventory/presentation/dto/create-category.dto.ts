import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ type: String, maxLength: 120, example: 'Equipos de laboratorio' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({ type: Number, minimum: 1, example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tiempoMaximoPrestamoDias!: number;
}
