import { IsDateString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  copyId!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Hora futura solicitada para recogida; la ventana termina 30 minutos después.',
  })
  @IsDateString()
  requestedAt!: Date;
}
