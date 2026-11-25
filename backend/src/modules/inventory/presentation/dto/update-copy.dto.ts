import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export class UpdateCopyDto {
  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 80)
  @Matches(/\S/)
  codigoInventario?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Habilitación administrativa explícita; no modifica aptitud ni libera un ejemplar retenido.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  habilitado?: boolean;
}
