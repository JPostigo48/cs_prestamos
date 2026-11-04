import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpeningIntervalDto {
  @ApiProperty({
    type: String,
    example: '09:00',
    pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$',
  })
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  opens!: string;

  @ApiProperty({
    type: String,
    example: '17:00',
    pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$',
  })
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  closes!: string;
}

export class OpeningDayDto {
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 7,
    description: 'ISO: lunes=1, domingo=7.',
  })
  @IsInt()
  @Min(1)
  @Max(7)
  day!: number;

  @ApiProperty({
    type: [OpeningIntervalDto],
    maxItems: 12,
    description: 'Ordenadas; [] indica día cerrado. No cruzan medianoche.',
  })
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => OpeningIntervalDto)
  intervals!: OpeningIntervalDto[];
}

export class PatchReservationSettingsDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 240,
    description:
      'Minutos enteros. Solo afecta reservas nuevas; valor inicial 30.',
  })
  @ValidateIf((_o, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(240)
  pickupWaitMinutes?: number;

  @ApiPropertyOptional({
    type: [OpeningDayDto],
    nullable: true,
    minItems: 7,
    maxItems: 7,
    description:
      'Reemplazo semanal completo en America/Lima. null desconfigura explícitamente.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OpeningDayDto)
  weeklySchedule?: OpeningDayDto[] | null;
}

export class ReservationSettingsResponseDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 240 })
  pickupWaitMinutes!: number;
  @ApiProperty({ type: [OpeningDayDto], nullable: true }) weeklySchedule!:
    OpeningDayDto[] | null;
  @ApiProperty({ type: 'integer', minimum: 1 }) version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, enum: ['America/Lima'] }) timeZone!: string;
  @ApiProperty({ type: String, enum: ['CONFIGURED', 'UNCONFIGURED'] })
  scheduleStatus!: string;
  @ApiProperty({ type: String, enum: ['FULL_WINDOW_WITHIN_INTERVAL'] })
  pickupWindowPolicy!: string;
  @ApiProperty({ type: String, nullable: true }) warning!: string | null;
}
