import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ type: Number, example: 0 })
  resourceCount!: number;
}

export class ResourceResponseDto {
  @ApiProperty({ type: String, format: 'uuid', example: resourceId })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', example: categoryId })
  categoriaId!: string;

  @ApiProperty({ type: String, example: 'Multímetro digital' })
  nombre!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Equipo para prácticas de laboratorio' })
  descripcion!: string | null;

  @ApiProperty({ type: Boolean, example: false })
  available!: boolean;

  @ApiProperty({ type: Number, example: 0 })
  totalCopies!: number;

  @ApiProperty({ type: Number, example: 0 })
  availableCopies!: number;
}

class ResourceCategoryDto {
  @ApiProperty({ type: String, format: 'uuid', example: categoryId })
  id!: string;

  @ApiProperty({ type: String, example: 'Equipos de laboratorio' })
  nombre!: string;

  @ApiProperty({ type: Number, example: 7 })
  tiempoMaximoPrestamoDias!: number;
}

export class ResourceDetailResponseDto extends ResourceResponseDto {
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

  @ApiProperty({ enum: ['DISPONIBLE', 'PRESTADO', 'NO_DISPONIBLE'], example: 'DISPONIBLE' })
  estado!: string;
}

export class ObservationResponseDto {
  @ApiProperty({ type: String, format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440003' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', example: copyId })
  ejemplarId!: string;

  @ApiProperty({ type: String, example: 'Carcasa con desgaste superficial' })
  descripcion!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-06T10:00:00.000Z' })
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
  availableCopies!: number;

  @ApiProperty({ type: Number, example: 1 })
  unavailableCopies!: number;

  @ApiProperty({ type: Number, example: 0 })
  borrowedCopies!: number;
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
