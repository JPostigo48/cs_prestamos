import { ApiProperty } from '@nestjs/swagger';
import { LoanStatus } from '../../domain/entities/loan.js';
import { ReservationStatus } from '../../domain/entities/reservation.js';
import {
  ResourceAccessoryResponseDto,
  ResourceLoanPolicyResponseDto,
} from '../../../inventory/presentation/dto/resource-configuration.dto.js';

export class CopyLoanSnapshotDto {
  @ApiProperty({ type: 'integer', enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: String, format: 'uuid' }) copyId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) resourceId!: string;
  @ApiProperty({
    type: ResourceLoanPolicyResponseDto,
    description:
      'Política histórica capturada al crear, no configuración actual.',
  })
  policy!: ResourceLoanPolicyResponseDto;
  @ApiProperty({ type: [ResourceAccessoryResponseDto] })
  accessories!: ResourceAccessoryResponseDto[];
}
export class ReturnChecklistPartResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) accessoryId!: string;
  @ApiProperty({ type: String }) nombre!: string;
  @ApiProperty({ type: Boolean }) received!: boolean;
}
export class ReturnChecklistResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) loanId!: string;
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Usuario operador/administrador que persistió la captura.',
  })
  actorId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) checkedAt!: string;
  @ApiProperty({
    type: CopyLoanSnapshotDto,
    nullable: true,
    description:
      'null identifica operación anterior a la captura histórica; no se reconstruye el pasado.',
  })
  configurationSnapshot!: CopyLoanSnapshotDto | null;
  @ApiProperty({ type: [ReturnChecklistPartResponseDto] })
  parts!: ReturnChecklistPartResponseDto[];
}

export class LoanReturnResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) loanId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) returnedAt!: string;
  @ApiProperty({ type: String, nullable: true }) observation!: string | null;
}

export class LoanResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) userId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) copyId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: LoanStatus }) status!: LoanStatus;
  @ApiProperty({ type: LoanReturnResponseDto, nullable: true })
  return!: LoanReturnResponseDto | null;
  @ApiProperty({ type: CopyLoanSnapshotDto, nullable: true })
  configurationSnapshot!: CopyLoanSnapshotDto | null;
  @ApiProperty({ type: ReturnChecklistResponseDto, nullable: true })
  returnChecklist!: ReturnChecklistResponseDto | null;
}

export class ReservationResponseDto {
  @ApiProperty({ type: CopyLoanSnapshotDto, nullable: true })
  configurationSnapshot!: CopyLoanSnapshotDto | null;
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) userId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) copyId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) requestedAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) pickupDeadline!: string;
  @ApiProperty({ type: 'integer' }) loanDurationHours!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  pickedUpAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt!: string | null;
  @ApiProperty({ enum: ReservationStatus }) status!: ReservationStatus;
  @ApiProperty({ type: String, nullable: true }) cancellationReason!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) loanId!:
    string | null;
}

export class LoanHistoryPageResponseDto {
  @ApiProperty({ type: [LoanResponseDto] }) items!: LoanResponseDto[];
  @ApiProperty({ type: 'integer', minimum: 0 }) total!: number;
  @ApiProperty({ type: 'integer', minimum: 1 }) page!: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 }) limit!: number;
}
export class ReservationsPageResponseDto {
  @ApiProperty({ type: [ReservationResponseDto] })
  items!: ReservationResponseDto[];
  @ApiProperty({ type: 'integer', minimum: 0 }) total!: number;
  @ApiProperty({ type: 'integer', minimum: 1 }) page!: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 }) limit!: number;
}
