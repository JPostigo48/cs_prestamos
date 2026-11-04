import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, ValidateIf } from 'class-validator';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'Desactivar conserva todos los datos; true reactiva.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string | null;

  @ApiPropertyOptional({
    type: String,
    maxLength: 120,
    example: 'Equipos de laboratorio',
  })
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

  @IsOptional()
  @ApiPropertyOptional({ type: Number, minimum: 1, example: 168 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tiempoMaximoPrestamoHoras?: number;
}
