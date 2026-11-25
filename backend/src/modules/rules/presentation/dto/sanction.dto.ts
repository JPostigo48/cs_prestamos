import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppealStatus } from '../../domain/entities/appeal.js';
import {
  AppealResponseDto,
  RuleVersionResponseDto,
  ViolationResponseDto,
} from './rules-response.dto.js';
import { SanctionResponseDto } from '../../../users/presentation/dto/users-response.dto.js';

export class AppealsQueryDto {
  @ApiPropertyOptional({ enum: AppealStatus })
  @IsOptional()
  @IsEnum(AppealStatus)
  status?: AppealStatus;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'USUARIO solo propio; sin filtro se limita a su titularidad.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sanctionId?: string;
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
export class SuspendUserDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'Regla manual activa; se aplica su versión vigente, descuento y suspensión. No admite políticas automáticas sin contexto.',
  })
  @IsUUID()
  ruleId!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 2000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'Clave de reintento por usuario. Igual contenido devuelve la sanción original; contenido distinto devuelve 409.',
  })
  @IsUUID()
  requestId!: string;
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Inicio esperado con zona. Si se envía debe coincidir con el calendario automático de la política; no permite programaciones arbitrarias.',
  })
  @ValidateIf((_o, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt?: string;
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Si se envía, debe coincidir con el fin calculado de la política; null solo para indefinida.',
  })
  @ValidateIf((_o, value) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt?: string | null;
}
export class LiftSanctionDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 2000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  resolution!: string;
}
export class SanctionHistoryDto {
  @ApiProperty({ type: String }) action!: string;
  @ApiProperty({ type: String, format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  actorAccountId!: string | null;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
}
export class SanctionAdjustmentResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) ruleVersionId!: string;
  @ApiProperty({ type: String }) severity!: string;
  @ApiProperty({ enum: ['DISCOUNT', 'SET_ZERO'] }) effect!: string;
  @ApiProperty({ type: Number, nullable: true }) nominalTarget!: number | null;
  @ApiProperty({ type: Number, nullable: true }) nominalIncrement!: number | null;
  @ApiProperty({ type: Number }) effectiveDiscount!: number;
  @ApiProperty({ type: Number }) previousTrust!: number;
  @ApiProperty({ type: Number }) resultingTrust!: number;
  @ApiProperty({ type: Number, nullable: true }) suspensionDays!: number | null;
  @ApiProperty({ type: String, format: 'date-time' }) effectiveAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) recordedAt!: string;
}
export class SanctionCurrentResponseDto {
  @ApiProperty({ type: String }) severity!: string;
  @ApiProperty({ type: RuleVersionResponseDto }) rule!: RuleVersionResponseDto;
  @ApiProperty({ type: Number, nullable: true, description: 'Objetivo nominal acumulado; null para SET_ZERO.' }) nominalPenaltyTotal!: number | null;
  @ApiProperty({ type: Number, description: 'Suma de descuentos efectivos, incluido el inicial una sola vez; no saldo actual del usuario.' }) effectivePenaltyTotal!: number;
  @ApiProperty({ type: Number, nullable: true }) suspensionDays!: number | null;
  @ApiProperty({ type: [SanctionAdjustmentResponseDto] }) adjustments!: SanctionAdjustmentResponseDto[];
}
export class SanctionDetailResponseDto extends SanctionResponseDto {
  @ApiPropertyOptional({ type: SanctionCurrentResponseDto, nullable: true, description: 'Consecuencia acumulada desde ajustes; null para legado sin ajustes. Los campos superiores conservan el antecedente inicial inmutable. Absolución no borra el historial.' })
  current?: SanctionCurrentResponseDto | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Fundamento registrado; null si no existe antecedente persistido.',
  })
  reason!: string | null;
  @ApiProperty({
    type: RuleVersionResponseDto,
    nullable: true,
    description: 'Versión histórica referenciada, nunca la vigente inferida.',
  })
  rule!: RuleVersionResponseDto | null;
  @ApiProperty({ type: ViolationResponseDto, nullable: true })
  violation!: ViolationResponseDto | null;
  @ApiProperty({ type: [AppealResponseDto] }) appeals!: AppealResponseDto[];
  @ApiProperty({ type: [SanctionHistoryDto] }) history!: SanctionHistoryDto[];
}
export class AppealsPageResponseDto {
  @ApiProperty({ minimum: 0, type: 'integer' }) total!: number;
  @ApiProperty({ minimum: 1, type: 'integer' }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100, type: 'integer' }) limit!: number;
  @ApiProperty({ type: [AppealResponseDto] }) items!: AppealResponseDto[];
}
