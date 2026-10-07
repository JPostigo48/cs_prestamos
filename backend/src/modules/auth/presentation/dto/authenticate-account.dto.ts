import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class AuthenticateAccountDto {
  @ApiProperty({ type: String, format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: String, format: 'password' })
  @IsString()
  password!: string;
}
