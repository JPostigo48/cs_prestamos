import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TermsVersionResponseDto } from './rules-response.dto.js';

class DelayCriteriaDto {
  @ApiProperty({ type: Number }) exclusiveMin!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Máximo inclusivo en horas; null significa sin límite superior.',
  })
  inclusiveMax!: number | null;
}
class NoShowCriteriaDto {
  @ApiProperty({ type: Number }) inclusiveMin!: number;
  @ApiProperty({ type: Number, nullable: true }) inclusiveMax!: number | null;
  @ApiProperty({ type: Number }) rollingDays!: number;
  @ApiProperty({ type: Number }) pickupMinutes!: number;
}
class RewardCriteriaDto {
  @ApiProperty({ type: Number }) referencePoints!: number;
  @ApiProperty({ type: Number }) fraction!: number;
  @ApiProperty({ type: Number }) maximumTrust!: number;
}
class AccessCriteriaDto {
  @ApiProperty({ type: [String] }) allowedLevels!: string[];
  @ApiProperty({ type: Number }) durationHours!: number;
  @ApiProperty({ type: Boolean }) campusOnly!: boolean;
}
class TrustLevelDto {
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number }) inclusiveMin!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'null: el límite superior es el máximo global inclusivo.',
  })
  exclusiveMax!: number | null;
}
class TrustCriteriaDto {
  @ApiProperty({ type: Number }) initial!: number;
  @ApiProperty({ type: Number }) minimum!: number;
  @ApiProperty({ type: Number }) maximum!: number;
  @ApiProperty({ type: Number }) decimals!: number;
  @ApiProperty({ type: [TrustLevelDto] }) levels!: TrustLevelDto[];
}
class PolicyCriteriaDto {
  @ApiProperty({ type: String }) condition!: string;
  @ApiPropertyOptional({ type: DelayCriteriaDto })
  delayHours?: DelayCriteriaDto;
  @ApiPropertyOptional({ type: NoShowCriteriaDto }) noShow?: NoShowCriteriaDto;
  @ApiPropertyOptional({ type: RewardCriteriaDto }) reward?: RewardCriteriaDto;
  @ApiPropertyOptional({ type: AccessCriteriaDto }) access?: AccessCriteriaDto;
  @ApiPropertyOptional({ type: TrustCriteriaDto }) trust?: TrustCriteriaDto;
}
export class PublicPolicyResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) ruleId!: string;
  @ApiProperty({ type: Number }) number!: number;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String }) key!: string;
  @ApiProperty({
    enum: [
      'LATENESS',
      'DAMAGE',
      'LOSS',
      'NO_SHOW',
      'REWARD',
      'ACCESS',
      'TRUST',
    ],
  })
  kind!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'null: aplica a todas las categorías o no depende de categoría.',
  })
  category!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) categoryId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) severity!: string | null;
  @ApiProperty({ enum: ['DISCOUNT', 'SET_ZERO', 'NONE'] }) trustEffect!: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Puntos porcentuales de descuento; null: no aplica, no significa cero.',
  })
  penaltyPoints!: number | null;
  @ApiProperty({
    type: String,
    nullable: true,
    enum: ['NINGUNA', 'TEMPORAL', 'INDEFINIDA', null],
  })
  suspensionType!: string | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'null se interpreta según suspensionType, no como cero días.',
  })
  suspensionDays!: number | null;
  @ApiProperty({ type: String }) consequence!: string;
  @ApiProperty({ type: PolicyCriteriaDto }) criteria!: PolicyCriteriaDto;
}
export class PublicTermsResponseDto extends TermsVersionResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date-time',
    description: 'Fecha de publicación persistida; null si no está disponible.',
  })
  publishedAt!: string | null;
  @ApiProperty({
    enum: ['COMPLETE', 'INCOMPLETE', 'UNAVAILABLE'],
    description:
      'Integridad de la matriz ligada a esta versión; nunca se completa desde reglas activas ni desde memoria.',
  })
  policiesStatus!: string;
  @ApiProperty({ type: [PublicPolicyResponseDto] })
  policies!: PublicPolicyResponseDto[];
}
