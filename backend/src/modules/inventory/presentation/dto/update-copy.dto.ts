import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class UpdateCopyDto {
  @ApiProperty({ type: String, maxLength: 80 })
  @IsString()
  @Length(1, 80)
  @Matches(/\S/)
  codigoInventario!: string;
}
