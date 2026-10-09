import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectRegistrationRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}