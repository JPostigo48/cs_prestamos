import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export const InventoryCopyState = {
  DISPONIBLE: 'DISPONIBLE',
  PRESTADO: 'PRESTADO',
  NO_DISPONIBLE: 'NO_DISPONIBLE',
} as const;

export type InventoryCopyState =
  (typeof InventoryCopyState)[keyof typeof InventoryCopyState];

export class UpdateCopyStateDto {
  @ApiProperty({ enum: InventoryCopyState })
  @IsEnum(InventoryCopyState)
  estado!: InventoryCopyState;
}
