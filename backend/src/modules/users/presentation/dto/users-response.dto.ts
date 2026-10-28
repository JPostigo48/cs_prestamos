import { ApiProperty } from '@nestjs/swagger';
import {
  RegistrationRequestStatus,
  UserType,
} from '../../domain/entities/registration-request.js';
import { SanctionStatus, TrustLevel } from '../../domain/entities/user.js';
import { PageMetadataDto } from '../../../../shared/presentation/dto/http-error.dto.js';
import { UserResponseDto } from './manage-user.dto.js';

export class AffiliationEvidenceResponseDto {
  @ApiProperty({ type: String }) information!: string;
}

export class RegistrationRequestResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ enum: UserType }) userType!: UserType;
  @ApiProperty({ type: String, nullable: true }) institutionalId!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time' }) requestedAt!: string;
  @ApiProperty({ enum: RegistrationRequestStatus })
  status!: RegistrationRequestStatus;
  @ApiProperty({ type: String, nullable: true }) rejectionReason!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  approvedUserId!: string | null;
  @ApiProperty({ type: [AffiliationEvidenceResponseDto] })
  evidence!: AffiliationEvidenceResponseDto[];
}

export class RegistrationRequestsPageResponseDto extends PageMetadataDto {
  @ApiProperty({ type: [RegistrationRequestResponseDto] })
  items!: RegistrationRequestResponseDto[];
}

export class ApprovedRegistrationResponseDto {
  @ApiProperty({ type: RegistrationRequestResponseDto })
  request!: RegistrationRequestResponseDto;
  @ApiProperty({ type: UserResponseDto }) user!: UserResponseDto;
}

export class SanctionResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) userId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) violationId!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) ruleId!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  ruleVersionId!: string | null;
  @ApiProperty({ enum: SanctionStatus }) status!: SanctionStatus;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) endsAt!:
    string | null;
  @ApiProperty({ type: Number }) previousTrust!: number;
  @ApiProperty({ type: Number }) resultingTrust!: number;
}

export class TrustProfileResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) userId!: string;
  @ApiProperty({ type: Number }) percentage!: number;
  @ApiProperty({ enum: TrustLevel }) level!: TrustLevel;
  @ApiProperty({ type: Boolean }) currentlyPenalized!: boolean;
}

export class LoanEligibilityResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) userId!: string;
  @ApiProperty({ type: Boolean }) enabled!: boolean;
  @ApiProperty({ enum: UserType }) institutionalType!: UserType;
  @ApiProperty({ type: Boolean }) eligible!: boolean;
  @ApiProperty({ type: [String] }) reasons!: string[];
  @ApiProperty({ type: Boolean }) hasCurrentAffiliation!: boolean;
  @ApiProperty({ type: [SanctionResponseDto] })
  activeSanctions!: SanctionResponseDto[];
  @ApiProperty({ type: Number }) trustPercentage!: number;
  @ApiProperty({ enum: TrustLevel }) trustLevel!: TrustLevel;
}
