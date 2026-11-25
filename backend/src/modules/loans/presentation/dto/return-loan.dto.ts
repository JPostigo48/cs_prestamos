import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateBy,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { DamageSeverity } from '../../domain/entities/loan-closure.js';

const hasIncident = (o: FinalInspectionDto) =>
  o.condition === 'DANADO' ||
  (Array.isArray(o.parts) && o.parts.some((p) => p?.received === false));

export class FinalInspectionPartDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() accessoryId!: string;
  @ApiProperty({ type: Boolean }) @IsBoolean() received!: boolean;
}

export class FinalInspectionDto {
  @ApiProperty({
    type: [FinalInspectionPartDto],
    uniqueItems: true,
    description:
      'Snapshot histórico completo y exacto, sin duplicados. Vacío solo si no tenía componentes.',
  })
  @IsArray()
  @ArrayUnique((p: FinalInspectionPartDto | null) => p?.accessoryId)
  @ValidateNested({ each: true })
  @Type(() => FinalInspectionPartDto)
  parts!: FinalInspectionPartDto[];

  @ApiProperty({ enum: ['SANO', 'DESGASTE_NORMAL', 'DANADO'] })
  @IsIn(['SANO', 'DESGASTE_NORMAL', 'DANADO'])
  condition!: 'SANO' | 'DESGASTE_NORMAL' | 'DANADO';

  @ApiPropertyOptional({
    enum: ['LEVE', 'MODERADA', 'GRAVE'],
    description:
      'Obligatoria con daño o faltantes; debe omitirse sin incidente. Se agrega un único daño.',
  })
  @ValidateIf((o: FinalInspectionDto, v) => v !== undefined || hasIncident(o))
  @ValidateBy({
    name: 'incidentSeverity',
    validator: {
      validate: (v, args) =>
        hasIncident(args!.object as FinalInspectionDto)
          ? ['LEVE', 'MODERADA', 'GRAVE'].includes(v)
          : v === undefined,
      defaultMessage: () =>
        'damageSeverity es obligatoria solo para daño o faltantes y debe omitirse sin incidente.',
    },
  })
  @IsIn(['LEVE', 'MODERADA', 'GRAVE'])
  damageSeverity?: DamageSeverity;

  @ApiPropertyOptional({
    type: String,
    maxLength: 1000,
    description: 'Obligatoria y no vacía con daño o faltantes.',
  })
  @ValidateIf((o: FinalInspectionDto, v) => v !== undefined || hasIncident(o))
  @IsString()
  @Matches(/\S/)
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    uniqueItems: true,
    description:
      'Obligatoria aunque vacía. Evidencias existentes de devolución/daño de este préstamo.',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  evidenceIds!: string[];
}

export class ReturnLoanDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() requestId!: string;

  @ApiProperty({ type: FinalInspectionDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => FinalInspectionDto)
  inspection!: FinalInspectionDto;

  @ApiPropertyOptional({ type: String, maxLength: 1000 })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(1000)
  observation?: string;
}

export class CloseIncidentDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() requestId!: string;
  @ApiProperty({ enum: ['PERDIDA', 'ROBO'] }) @IsIn(['PERDIDA', 'ROBO']) kind!:
    'PERDIDA' | 'ROBO';
  @ApiProperty({ type: Boolean, enum: [true] }) @Equals(true) confirmed!: true;
  @ApiProperty({ type: String, maxLength: 1000 })
  @IsString()
  @Matches(/\S/)
  @MaxLength(1000)
  description!: string;
  @ApiProperty({
    type: [String],
    format: 'uuid',
    uniqueItems: true,
    description:
      'Obligatoria aunque vacía. Evidencias existentes de pérdida del mismo préstamo.',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  evidenceIds!: string[];
}
