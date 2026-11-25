import { ApiProperty } from '@nestjs/swagger';
import { FinalInspectionDto } from './return-loan.dto.js';
import { PublicPolicyResponseDto } from '../../../rules/presentation/dto/public-terms-response.dto.js';

class ClosureInspectionResponseDto extends FinalInspectionDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
}
export class LoanClosureResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) requestId!: string;
  @ApiProperty({ enum: ['DEVOLUCION', 'PERDIDA', 'ROBO'] }) reason!: string;
  @ApiProperty({ type: String, format: 'date-time' }) effectiveAt!: string;
  @ApiProperty({ type: String, format: 'uuid' }) actorAccountId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) actorUserId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) categoryId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) termsVersionId!: string;
  @ApiProperty({ type: ClosureInspectionResponseDto, nullable: true })
  inspection!: ClosureInspectionResponseDto | null;
}
export class LoanConsequenceResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) violationId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) sanctionId!: string;
  @ApiProperty({ type: String }) kind!: string;
  @ApiProperty({ type: String, nullable: true }) severity!: string | null;
  @ApiProperty({ type: String, format: 'uuid' }) ruleVersionId!: string;
  @ApiProperty({ type: Number, nullable: true }) configuredPenaltyPoints!:
    number | null;
  @ApiProperty({ type: Number }) effectivePenaltyTotal!: number;
  @ApiProperty({ type: String }) suspensionType!: string;
  @ApiProperty({ type: Number, nullable: true }) suspensionDays!: number | null;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) endsAt!:
    string | null;
}
export class LoanRewardResponseDto {
  @ApiProperty({ type: Boolean }) eligible!: boolean;
  @ApiProperty({ enum: ['PUNTUAL_Y_COMPLETO', 'MORA', 'INCIDENTE'] })
  reason!: string;
  @ApiProperty({ type: String, format: 'uuid' }) ruleVersionId!: string;
  @ApiProperty({ type: Number }) referencePoints!: number;
  @ApiProperty({ type: Number }) fraction!: number;
  @ApiProperty({ type: Number }) calculatedPoints!: number;
  @ApiProperty({ type: Number }) effectivePoints!: number;
  @ApiProperty({ type: Number }) previousTrust!: number;
  @ApiProperty({ type: Number }) resultingTrust!: number;
}
export class ClosedCopyResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['DISPONIBLE', 'NO_DISPONIBLE'] }) estado!: string;
  @ApiProperty({ type: String, nullable: true }) condicionFisica!:
    string | null;
  @ApiProperty({ type: Boolean }) habilitado!: boolean;
}
class HistoricalAccessoryResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) nombre!: string;
}
class ReturnPolicyOptionResponseDto extends PublicPolicyResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) versionId!: string;
}
class ReturnLatenessResponseDto {
  @ApiProperty({ type: Boolean, enum: [true] }) automatic!: true;
  @ApiProperty({ type: String, nullable: true }) currentSeverity!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) targetSeverity!: string | null;
  @ApiProperty({ type: Number }) appliedPenaltyPoints!: number;
  @ApiProperty({ type: Number }) targetPenaltyPoints!: number;
  @ApiProperty({ type: Number }) targetSuspensionDays!: number;
}
export class ReturnPolicyResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) loanId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) serverNow!: string;
  @ApiProperty({ type: String, format: 'date-time' }) endsAt!: string;
  @ApiProperty({ type: String, format: 'uuid' }) categoryId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) termsVersionId!: string;
  @ApiProperty({
    enum: [
      'LOAN_SNAPSHOT',
      'LOAN_NO_SHOW_SNAPSHOT',
      'RESERVATION_SNAPSHOT',
      'RESERVATION_CONFIRMATION',
    ],
  })
  policySource!: string;
  @ApiProperty({ type: [HistoricalAccessoryResponseDto] })
  accessories!: HistoricalAccessoryResponseDto[];
  @ApiProperty({ type: [ReturnPolicyOptionResponseDto] })
  damageOptions!: ReturnPolicyOptionResponseDto[];
  @ApiProperty({ type: ReturnLatenessResponseDto })
  lateness!: ReturnLatenessResponseDto;
  @ApiProperty({ type: ReturnPolicyOptionResponseDto })
  lossPolicy!: ReturnPolicyOptionResponseDto;
  @ApiProperty({ type: ReturnPolicyOptionResponseDto })
  rewardPolicy!: ReturnPolicyOptionResponseDto;
}
