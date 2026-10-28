import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { UserType } from '../../domain/entities/registration-request.js';

export class CreateUserDto {
  @ApiProperty({ type: String, minLength: 2, maxLength: 180 })
  @IsString()
  @Length(2, 180)
  @Matches(/\S/)
  name!: string;

  @ApiProperty({ enum: Object.values(UserType) })
  @IsIn(Object.values(UserType))
  userType!: UserType;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 80 })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Length(1, 80)
  @Matches(/\S/)
  institutionalId?: string | null;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  hasCurrentAffiliation?: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto, {
  skipNullProperties: false,
}) {}

export class UserResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ enum: Object.values(UserType) }) userType!: UserType;
  @ApiProperty({ type: String, nullable: true }) institutionalId!:
    string | null;
  @ApiProperty({ type: Boolean }) hasCurrentAffiliation!: boolean;
  @ApiProperty({ type: Number, minimum: 0, maximum: 100 })
  trustPercentage!: number;
}

export class UsersPageResponseDto {
  @ApiProperty({ type: [UserResponseDto] }) items!: UserResponseDto[];
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) limit!: number;
}
