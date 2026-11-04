import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum LoanEvidenceType {
  ENTREGA = 'ENTREGA',
  DEVOLUCION = 'DEVOLUCION',
  DANO = 'DANO',
  PERDIDA = 'PERDIDA',
}

export class UploadLoanEvidenceDto {
  @ApiProperty({ enum: LoanEvidenceType })
  @IsEnum(LoanEvidenceType)
  type!: LoanEvidenceType;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
