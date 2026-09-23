import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTermsVersionDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  number!: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class AcceptTermsVersionDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  termsVersionId!: string;

  @Type(() => Date)
  @IsDate()
  acceptedAt!: Date;
}
