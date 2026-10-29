import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanStatus } from '../../domain/entities/loan.js';
import { ReservationStatus } from '../../domain/entities/reservation.js';

export class LoanPageQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 21474836,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(21474836)
  page = 1;
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
export class ResourceHistoryQueryDto extends LoanPageQueryDto {
  @ApiPropertyOptional({ enum: LoanStatus })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(LoanStatus)
  status?: LoanStatus;
}
export class ReservationsQueryDto extends LoanPageQueryDto {
  @ApiPropertyOptional({ enum: ReservationStatus })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'USUARIO solo puede indicar su propio ID. Sin filtro, se limita a sus reservas.',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID()
  userId?: string;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'ID de ejemplar, no del artículo.',
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID()
  copyId?: string;
}
export class ReturnChecklistPartDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() accessoryId!: string;
  @ApiProperty({ type: Boolean }) @IsBoolean() received!: boolean;
}
export class SaveReturnChecklistDto {
  @ApiProperty({
    type: [ReturnChecklistPartDto],
    maxItems: 100,
    description:
      'Todos los accesorios del snapshot, una vez cada uno. Legacy sin snapshot: únicamente []. No usar catálogo actual.',
  })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnChecklistPartDto)
  parts!: ReturnChecklistPartDto[];
  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Instante de inspección con zona; entre inicio del préstamo y hora del servidor. Actor obtenido del JWT, nunca del cuerpo.',
  })
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  checkedAt!: string;
}
