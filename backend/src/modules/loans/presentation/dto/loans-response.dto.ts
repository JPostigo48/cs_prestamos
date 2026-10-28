import { ApiProperty } from '@nestjs/swagger';
import { LoanStatus } from '../../domain/entities/loan.js';
import { ReservationStatus } from '../../domain/entities/reservation.js';

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
}

export class ReservationResponseDto {
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
