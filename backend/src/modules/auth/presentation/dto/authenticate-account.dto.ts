import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class AuthenticateAccountDto {
  @ApiProperty({ type: String, format: 'email', example: 'usuario@ejemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: String, format: 'password', example: 'ClaveEjemplo123' })
  @IsString()
  password!: string;
}
