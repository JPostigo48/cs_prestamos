import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ type: String, maxLength: 120, example: 'Equipos de laboratorio' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, example: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tiempoMaximoPrestamoDias?: number;
}
