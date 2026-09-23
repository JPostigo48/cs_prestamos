import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UserType } from '../../domain/entities/registration-request.js';

export class SubmitRegistrationRequestDto {
  @IsEnum(UserType)
  userType!: UserType;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(80)
  institutionalId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];
}
