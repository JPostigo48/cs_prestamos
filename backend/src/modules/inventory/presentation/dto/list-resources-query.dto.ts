import {
  IsBooleanString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListResourcesQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsBooleanString()
  available?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}