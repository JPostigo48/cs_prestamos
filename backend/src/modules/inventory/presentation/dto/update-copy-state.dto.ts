import { IsEnum } from 'class-validator';

export const InventoryCopyState = {
  DISPONIBLE: 'DISPONIBLE',
  PRESTADO: 'PRESTADO',
  NO_DISPONIBLE: 'NO_DISPONIBLE',
} as const;

export type InventoryCopyState =
  (typeof InventoryCopyState)[keyof typeof InventoryCopyState];

export class UpdateCopyStateDto {
  @IsEnum(InventoryCopyState)
  estado!: InventoryCopyState;
}
