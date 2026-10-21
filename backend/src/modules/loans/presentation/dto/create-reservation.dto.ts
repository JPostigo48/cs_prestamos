import { IsDateString, IsUUID } from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  copyId!: string;

  @IsDateString()
  requestedAt!: Date;
}
