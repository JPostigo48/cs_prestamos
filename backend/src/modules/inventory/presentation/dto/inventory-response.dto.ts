import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageMetadataDto } from '../../../../shared/presentation/dto/http-error.dto.js';
import { ResourceLoanPolicyResponseDto } from './resource-configuration.dto.js';
import {
  physicalConditions,
  type PhysicalCondition,
} from '../../domain/entities/inventory.types.js';

const categoryId = '550e8400-e29b-41d4-a716-446655440000';
const resourceId = '550e8400-e29b-41d4-a716-446655440001';
const copyId = '550e8400-e29b-41d4-a716-446655440002';

class InventoryCapabilitiesDto {
  @ApiProperty({ type: Boolean }) physicalCondition!: boolean;
  @ApiProperty({ type: Boolean }) administrativeEnablement!: boolean;
  @ApiProperty({ type: Boolean }) verifiedAvailability!: boolean;
}

class InventoryActionsDto {
  @ApiProperty({ type: Boolean, enum: [true] }) descriptiveEdits!: true;
  @ApiProperty({ type: Boolean }) create!: boolean;
  @ApiProperty({ type: Boolean }) activate!: boolean;
  @ApiProperty({ type: Boolean }) release!: boolean;
  @ApiProperty({ type: Boolean }) rehabilitate!: boolean;
  @ApiProperty({ type: Boolean }) manageCopy!: boolean;
}

export class InventoryCompatibilityDto {
  @ApiProperty({ enum: ['READY', 'UPDATE_PENDING'] }) status!:
    'READY' | 'UPDATE_PENDING';
  @ApiProperty({ type: String, nullable: true }) message!: string | null;
  @ApiProperty({ type: InventoryCapabilitiesDto })
  capabilities!: InventoryCapabilitiesDto;
  @ApiProperty({
    type: InventoryActionsDto,
    description:
      'Prerrequisitos del esquema; no reemplazan autorización ni elegibilidad del ejemplar.',
  })
  actions!: InventoryActionsDto;
}

export class RegisteredStockDto {
  @ApiProperty({ type: 'integer' }) libres!: number;
  @ApiProperty({ type: 'integer' }) prestados!: number;
  @ApiProperty({ type: 'integer' }) retenidos!: number;
  @ApiProperty({ type: 'integer' }) reservados!: number;
}

export class CategoryResponseDto {
  @ApiProperty({ type: String, nullable: true }) descripcion!: string | null;
  @ApiProperty({ type: Boolean }) activo!: boolean;
  @ApiProperty({ type: Number }) copyCount!: number;
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
  @ApiProperty({ type: InventoryCompatibilityDto })
  compatibility!: InventoryCompatibilityDto;
  @ApiProperty({
    type: RegisteredStockDto,
    description: 'Ocupación registrada, no disponibilidad.',
  })
  registeredStock!: RegisteredStockDto;
  @ApiProperty({ type: Boolean }) activo!: boolean;
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

  @ApiProperty({ type: Boolean, nullable: true, example: false })
  available!: boolean | null;

  @ApiProperty({ type: Number, example: 0 })
  totalCopies!: number;

  @ApiProperty({ type: Number, nullable: true, example: 0 })
  availableCopies!: number | null;
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
  @ApiProperty({ type: InventoryCompatibilityDto })
  compatibility!: InventoryCompatibilityDto;
  @ApiProperty({ type: [CatalogResourceResponseDto] })
  data!: CatalogResourceResponseDto[];
}

export class GlobalAvailabilityResponseDto extends CatalogResourceResponseDto {
  @ApiProperty({ type: 'integer', nullable: true }) disponibles!: number | null;
  @ApiProperty({ type: 'integer' }) prestados!: number;
  @ApiProperty({ type: 'integer', nullable: true }) noDisponibles!:
    number | null;
  @ApiProperty({ type: 'integer' }) reservados!: number;
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
  @ApiProperty({ type: InventoryCompatibilityDto })
  compatibility!: InventoryCompatibilityDto;
  @ApiProperty({
    type: String,
    enum: [...physicalConditions],
    nullable: true,
    description:
      'null: condición desconocida; no acredita ni descarta aptitud.',
  })
  condicionFisica!: PhysicalCondition | null;

  @ApiProperty({
    type: Boolean,
    nullable: true,
    description:
      'Habilitación administrativa independiente de ocupación y aptitud; null cuando la columna no está disponible.',
  })
  habilitado!: boolean | null;

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
  @ApiProperty({ type: InventoryCompatibilityDto })
  compatibility!: InventoryCompatibilityDto;
  @ApiProperty({ type: RegisteredStockDto })
  registeredStock!: RegisteredStockDto;
  @ApiProperty({ type: 'integer' }) reservados!: number;
  @ApiProperty({ type: String, format: 'uuid', example: resourceId })
  resourceId!: string;

  @ApiProperty({ type: Boolean, nullable: true, example: true })
  available!: boolean | null;

  @ApiProperty({ type: Number, example: 2 })
  totalCopies!: number;

  @ApiProperty({ type: Number, nullable: true, example: 1 })
  disponibles!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 1 })
  noDisponibles!: number | null;

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
  @ApiProperty({ type: Boolean, enum: [false] }) habilitado!: false;
  @ApiProperty({ type: Boolean, enum: [false] }) deleted!: false;
  @ApiProperty({ type: Boolean, enum: [true] }) deactivated!: true;
  @ApiProperty({ type: String, format: 'uuid' }) copyId!: string;
  @ApiProperty({ enum: ['NO_DISPONIBLE'] }) estado!: 'NO_DISPONIBLE';
}
