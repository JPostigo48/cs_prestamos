import { IsDateString, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  copyId!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Fecha futura ISO 8601 con Z u offset explícito. Ventana configurable (inicial 30 min), completa dentro de una franja America/Lima si hay horario configurado.',
  })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/)
  requestedAt!: Date;
}
