import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageMetadataDto } from '../../../../shared/presentation/dto/http-error.dto.js';
import { ResourceLoanPolicyResponseDto } from './resource-configuration.dto.js';

const categoryId = '550e8400-e29b-41d4-a716-446655440000';
const resourceId = '550e8400-e29b-41d4-a716-446655440001';
const copyId = '550e8400-e29b-41d4-a716-446655440002';

export class CategoryResponseDto {
  @ApiProperty({ type: String, format: 'uuid', example: categoryId })
  id!: string;

  @ApiProperty({ type: String, example: 'Equipos de laboratorio' })
  nombre!: string;

  @ApiProperty({ type: Number, example: 7 })
  tiempoMaximoPrestamoDias!: number;

  @ApiProperty({ type: Number, example: 168 })
  tiempoMaximoPrestamoHoras!: number;

  @ApiProperty({ type: Number, example: 0 })
  resourceCount!: number;
}

export class ResourceResponseDto {
  @ApiProperty({
    type: 'integer',
    nullable: true,
    minimum: 1,
    description: 'Excepción individual en horas; null hereda la categoría.',
  })
  durationHours!: number | null;

  @ApiProperty({ type: String, format: 'uuid', example: resourceId })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', example: categoryId })
  categoriaId!: string;

  @ApiProperty({ type: String, example: 'Multímetro digital' })
  nombre!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Equipo para prácticas de laboratorio',
  })
  descripcion!: string | null;

  @ApiProperty({ type: Boolean, example: false })
  available!: boolean;

  @ApiProperty({ type: Number, example: 0 })
  totalCopies!: number;

  @ApiProperty({ type: Number, example: 0 })
  availableCopies!: number;
}

export class CatalogCategoryResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) nombre!: string;
}

export class CatalogResourceResponseDto extends ResourceResponseDto {
  @ApiPropertyOptional({
    type: CatalogCategoryResponseDto,
    description: 'Se omite si no se encuentra la categoría.',
  })
  categoria?: CatalogCategoryResponseDto;
}

export class ResourcesPageResponseDto extends PageMetadataDto {
  @ApiProperty({ type: [CatalogResourceResponseDto] })
  data!: CatalogResourceResponseDto[];
}

export class GlobalAvailabilityResponseDto extends CatalogResourceResponseDto {
  @ApiProperty({ type: 'integer' }) disponibles!: number;
  @ApiProperty({ type: 'integer' }) prestados!: number;
  @ApiProperty({ type: 'integer' }) noDisponibles!: number;
}

class ResourceCategoryDto {
  @ApiProperty({ type: String, format: 'uuid', example: categoryId })
  id!: string;

  @ApiProperty({ type: String, example: 'Equipos de laboratorio' })
  nombre!: string;

  @ApiProperty({ type: Number, example: 7 })
  tiempoMaximoPrestamoDias!: number;

  @ApiProperty({ type: Number, example: 168 })
  tiempoMaximoPrestamoHoras!: number;
}

export class ResourceDetailResponseDto extends ResourceResponseDto {
  @ApiProperty({ type: ResourceLoanPolicyResponseDto })
  loanPolicy!: ResourceLoanPolicyResponseDto;

  @ApiProperty({ type: ResourceCategoryDto, nullable: true })
  categoria!: ResourceCategoryDto | null;
}

export class CopyResponseDto {
  @ApiProperty({ type: String, format: 'uuid', example: copyId })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', example: resourceId })
  recursoId!: string;

  @ApiProperty({ type: String, example: 'LAB-001' })
  codigoInventario!: string;

  @ApiProperty({
    enum: ['DISPONIBLE', 'RESERVADO', 'PRESTADO', 'NO_DISPONIBLE'],
    example: 'DISPONIBLE',
  })
  estado!: string;
}

export class ObservationResponseDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', example: copyId })
  ejemplarId!: string;

  @ApiProperty({ type: String, example: 'Carcasa con desgaste superficial' })
  descripcion!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-10-06T10:00:00.000Z',
  })
  fecha!: string;
}

class CopyResourceDto {
  @ApiProperty({ type: String, format: 'uuid', example: resourceId })
  id!: string;

  @ApiProperty({ type: String, example: 'Multímetro digital' })
  nombre!: string;

  @ApiProperty({ type: String, format: 'uuid', example: categoryId })
  categoriaId!: string;
}

export class CopyDetailResponseDto extends CopyResponseDto {
  @ApiProperty({ type: CopyResourceDto })
  recurso!: CopyResourceDto;

  @ApiProperty({ type: [ObservationResponseDto] })
  observaciones!: ObservationResponseDto[];
}

export class ResourceAvailabilityResponseDto {
  @ApiProperty({ type: String, format: 'uuid', example: resourceId })
  resourceId!: string;

  @ApiProperty({ type: Boolean, example: true })
  available!: boolean;

  @ApiProperty({ type: Number, example: 2 })
  totalCopies!: number;

  @ApiProperty({ type: Number, example: 1 })
  disponibles!: number;

  @ApiProperty({ type: Number, example: 1 })
  noDisponibles!: number;

  @ApiProperty({ type: Number, example: 0 })
  prestados!: number;
}

export class DeletedCategoryResponseDto {
  @ApiProperty({ type: Boolean, example: true })
  deleted!: boolean;

  @ApiProperty({ type: String, format: 'uuid', example: categoryId })
  categoryId!: string;
}

export class DeletedResourceResponseDto {
  @ApiProperty({ type: Boolean, example: true })
  deleted!: boolean;

  @ApiProperty({ type: String, format: 'uuid', example: resourceId })
  resourceId!: string;
}

export class DeactivatedCopyResponseDto {
  @ApiProperty({ type: Boolean, enum: [false] }) deleted!: false;
  @ApiProperty({ type: Boolean, enum: [true] }) deactivated!: true;
  @ApiProperty({ type: String, format: 'uuid' }) copyId!: string;
  @ApiProperty({ enum: ['NO_DISPONIBLE'] }) estado!: 'NO_DISPONIBLE';
}
