import { IsEmail, IsString } from 'class-validator';

export class AuthenticateAccountDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
