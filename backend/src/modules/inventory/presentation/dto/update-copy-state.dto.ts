import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  Equals,
  IsArray,
  IsDefined,
  IsEnum,
  IsObject,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CopyVerificationDto {
  @ApiProperty({ type: Boolean, enum: [true] })
  @Equals(true)
  fitForLoan!: true;

  @ApiProperty({ type: Boolean, enum: [true] })
  @Equals(true)
  componentsComplete!: true;

  @ApiProperty({ type: String, minLength: 1, maxLength: 1000 })
  @IsString()
  @Length(1, 1000)
  @Matches(/\S/)
  reason!: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    uniqueItems: true,
    description:
      'Obligatorio, admite []. Evidencias existentes de préstamos del mismo ejemplar.',
  })
  @IsArray()
  @ArrayUnique((id: unknown) =>
    typeof id === 'string' ? id.toLowerCase() : id,
  )
  @IsUUID(undefined, { each: true })
  evidenceIds!: string[];
}

export const InventoryCopyState = {
  DISPONIBLE: 'DISPONIBLE',
  PRESTADO: 'PRESTADO',
  NO_DISPONIBLE: 'NO_DISPONIBLE',
} as const;

export type InventoryCopyState =
  (typeof InventoryCopyState)[keyof typeof InventoryCopyState];

export class UpdateCopyStateDto {
  @ApiProperty({
    enum: InventoryCopyState,
    example: InventoryCopyState.NO_DISPONIBLE,
  })
  @IsEnum(InventoryCopyState)
  estado!: InventoryCopyState;

  @ApiPropertyOptional({
    type: CopyVerificationDto,
    description:
      'Obligatoria para DISPONIBLE desde NO_DISPONIBLE o condición distinta de APTO (incluido null). No habilita administrativamente.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CopyVerificationDto)
  verification?: CopyVerificationDto;
}
