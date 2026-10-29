import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResourceAccessoryInputDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'ID existente del mismo recurso. Conservarlo al renombrar; omitirlo reutiliza un nombre normalizado previo o crea un accesorio.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  id?: string;

  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 120,
    example: 'Cargador',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  nombre!: string;
}

export class ReplaceResourceAccessoriesDto {
  @ApiProperty({
    type: [ResourceAccessoryInputDto],
    maxItems: 100,
    description:
      'Lista completa, nombres normalizados e IDs únicos. [] retira todos mediante baja lógica; nunca elimina IDs históricos.',
  })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ResourceAccessoryInputDto)
  items!: ResourceAccessoryInputDto[];
}

export class UpdateResourceLoanPolicyDto {
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 2147483647,
    nullable: true,
    example: 8,
    description:
      'Horas máximas de este artículo y sus ejemplares; null retira la excepción y hereda la categoría. No modifica operaciones ya creadas ni reglas de acceso o confianza.',
  })
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  durationHours!: number | null;
}

export class ResourceAccessoryResponseDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'ID estable, conservado aun al retirar el accesorio.',
  })
  id!: string;
  @ApiProperty({ type: String, maxLength: 120 }) nombre!: string;
}

export class ResourceAccessoriesResponseDto {
  @ApiProperty({
    type: [ResourceAccessoryResponseDto],
    description:
      'Solo accesorios activos de la plantilla del artículo. Las inspecciones deben usar su snapshot, no esta lista mutable.',
  })
  items!: ResourceAccessoryResponseDto[];
}

export class ResourceLoanPolicyResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) resourceId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) categoryId!: string;
  @ApiProperty({
    type: 'integer',
    nullable: true,
    minimum: 1,
    maximum: 2147483647,
    description: 'Excepción individual; null hereda la duración de categoría.',
  })
  durationHours!: number | null;
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    description:
      'Duración efectiva actual en horas, sin redondear a días. Debe congelarse al crear reserva/préstamo.',
  })
  effectiveDurationHours!: number;
  @ApiProperty({
    enum: ['RESOURCE', 'CATEGORY'],
    description:
      'RESOURCE: excepción individual; CATEGORY: horas actuales de categoría o días × 24 si las horas son null. No altera las reglas versionadas.',
  })
  source!: 'RESOURCE' | 'CATEGORY';
}
